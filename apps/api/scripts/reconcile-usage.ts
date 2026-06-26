import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../src/database/prisma.service";
import { UsageRepository } from "../src/modules/usage/usage.repository";
import { UsageService } from "../src/modules/usage/usage.service";

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? readRootEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const prisma = new PrismaService(
    new ConfigService({ database: { url: databaseUrl, poolMax: 10, queryTimeoutMs: 30_000 } }),
  );
  await prisma.$connect();
  const service = new UsageService(
    new UsageRepository(prisma),
    { isAvailable: false, cache: {} } as never,
    { increment: () => undefined } as never,
  );
  try {
    const organizations = await service.activeOrganizationIds();
    for (const organization of organizations) await service.reconcile(organization.id);
    process.stdout.write(`Reconciled usage counters for ${organizations.length} organizations.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

function readRootEnv(key: string) {
  try {
    const source = readFileSync(resolve(process.cwd(), "../../.env"), "utf8");
    const line = source.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

void main();
