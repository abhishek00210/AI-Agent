import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../src/database/prisma.service";
import { AnalyticsRepository } from "../src/modules/analytics/analytics.repository";
import { AnalyticsService } from "../src/modules/analytics/analytics.service";

async function main() {
  const url = process.env.DATABASE_URL ?? env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is required.");
  const db = new PrismaService(
    new ConfigService({ database: { url, poolMax: 20, queryTimeoutMs: 10_000 } }),
  );
  await db.$connect();
  const id = randomUUID();
  await db.organization.create({
    data: { id, name: "Analytics benchmark", slug: `analytics-benchmark-${id}` },
  });
  const repository = new AnalyticsRepository(db);
  const service = new AnalyticsService(repository, { isAvailable: false } as never);
  try {
    const start = new Date(Date.UTC(2025, 0, 1));
    const rows = Array.from({ length: 365 }, (_, index) => ({
      organizationId: id,
      date: new Date(start.getTime() + index * 86_400_000),
      totalCalls: index < 265 ? 2740 : 2739,
      incomingCalls: 2000,
      outgoingCalls: 740,
      appointments: 40,
      leads: 100,
      conversionRate: 40,
      aiMinutes: 1200,
      revenue: 5000,
      callDurationSeconds: 300000,
      avgCallDuration: 109.49,
    }));
    await db.analyticsDailyMetric.createMany({ data: rows });
    const range = { from: start, to: new Date(start.getTime() + 365 * 86_400_000) };
    const samples: number[] = [];
    for (let index = 0; index < 100; index++) {
      const at = performance.now();
      const result = await service.dashboard(id, range);
      samples.push(performance.now() - at);
      if (result.overview.totalCalls !== 1_000_000)
        throw new Error("Million-call snapshot total mismatch.");
    }
    process.stdout.write(
      `${JSON.stringify({ samples: 100, representedCalls: 1_000_000, dashboardMs: percentiles(samples) }, null, 2)}\n`,
    );
  } finally {
    await db.organization.delete({ where: { id } });
    await db.$disconnect();
  }
}
function percentiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const p = (n: number) => sorted[Math.ceil(n * sorted.length) - 1];
  return { p50: +p(0.5).toFixed(3), p95: +p(0.95).toFixed(3), p99: +p(0.99).toFixed(3) };
}
function env(key: string) {
  try {
    const line = readFileSync(resolve(process.cwd(), "../../.env"), "utf8")
      .split(/\r?\n/)
      .find((item) => item.startsWith(`${key}=`));
    return line
      ?.slice(key.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}
void main();
