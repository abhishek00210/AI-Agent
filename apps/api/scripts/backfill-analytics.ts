import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../src/database/prisma.service";
import { AnalyticsAggregationService } from "../src/modules/analytics/analytics-aggregation.service";
import { AnalyticsRepository } from "../src/modules/analytics/analytics.repository";
import { AnalyticsSnapshotService } from "../src/modules/analytics/analytics-snapshot.service";

async function main() {
  const url = process.env.DATABASE_URL ?? env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is required.");
  const db = new PrismaService(
    new ConfigService({ database: { url, poolMax: 10, queryTimeoutMs: 30_000 } }),
  );
  await db.$connect();
  const repository = new AnalyticsRepository(db);
  const aggregation = new AnalyticsAggregationService(repository);
  const snapshots = new AnalyticsSnapshotService(repository);
  const requestedDays = process.argv.slice(2).find((value) => /^\d+$/.test(value));
  const days = Math.min(366, Math.max(1, Number(requestedDays ?? 365)));
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  try {
    const organizations = await repository.organizations();
    for (const organization of organizations) {
      await aggregation.backfill(organization.id, from, new Date(to.getTime() + 86_400_000));
      await snapshots.generate(organization.id);
    }
    process.stdout.write(`Backfilled ${days} days for ${organizations.length} organizations.\n`);
  } finally {
    await db.$disconnect();
  }
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
