import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../src/database/prisma.service";
import { UsageRepository } from "../src/modules/usage/usage.repository";
import { UsageService } from "../src/modules/usage/usage.service";

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? readRootEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const prisma = new PrismaService(
    new ConfigService({ database: { url: databaseUrl, poolMax: 30, queryTimeoutMs: 10_000 } }),
  );
  await prisma.$connect();
  const organizationId = randomUUID();
  await prisma.organization.create({
    data: {
      id: organizationId,
      name: "Usage benchmark",
      slug: `usage-benchmark-${organizationId}`,
    },
  });
  const redis = { isAvailable: false, cache: {} };
  const metrics = { increment: () => undefined };
  const service = new UsageService(new UsageRepository(prisma), redis as never, metrics as never);

  try {
    await service.getUsage(organizationId);
    const updateSamples: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      await service.increment({
        organizationId,
        resourceType: "MESSAGES",
        idempotencyKey: `sequential:${index}`,
      });
      updateSamples.push(performance.now() - started);
    }

    const concurrentStarted = performance.now();
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        service.increment({
          organizationId,
          resourceType: "SMS_MESSAGES",
          idempotencyKey: `concurrent-sms:${index}`,
        }),
      ),
    );
    const concurrentMs = performance.now() - concurrentStarted;

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        service.increment({
          organizationId,
          resourceType: "AI_MINUTES",
          quantity: index + 1,
          idempotencyKey: `concurrent-call:${index}`,
          metadata: { durationSeconds: (index + 1) * 60 },
        }),
      ),
    );

    const lookupSamples: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      await service.getUsage(organizationId);
      lookupSamples.push(performance.now() - started);
    }
    const usage = await service.getUsage(organizationId);
    process.stdout.write(
      `${JSON.stringify(
        {
          samples: 100,
          counterUpdateMs: percentiles(updateSamples),
          usageLookupMs: percentiles(lookupSamples),
          concurrent100SmsMs: Number(concurrentMs.toFixed(3)),
          exactConcurrentSmsCount: usage.values.SMS_MESSAGES,
          exactSequentialMessageCount: usage.values.MESSAGES,
          exactConcurrentCallMinutes: usage.values.AI_MINUTES,
        },
        null,
        2,
      )}\n`,
    );
    if (
      usage.values.SMS_MESSAGES !== 100 ||
      usage.values.MESSAGES !== 100 ||
      usage.values.AI_MINUTES !== 55
    )
      process.exitCode = 1;
  } finally {
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  }
}

function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (value: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)];
  return {
    p50: Number(percentile(0.5).toFixed(3)),
    p95: Number(percentile(0.95).toFixed(3)),
    p99: Number(percentile(0.99).toFixed(3)),
  };
}

void main();

function readRootEnv(key: string) {
  try {
    const source = readFileSync(resolve(process.cwd(), "../../.env"), "utf8");
    const line = source.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
    return line
      ?.slice(key.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}
