import { Injectable } from "@nestjs/common";
import { AnalyticsRepository } from "./analytics.repository";

@Injectable()
export class AnalyticsSnapshotService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async generate(organizationId: string, at = new Date()) {
    const db = this.repository.client();
    const date = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    const [subscriptions, plans] = await Promise.all([
      db.subscription.groupBy({
        by: ["plan"],
        where: { organizationId, status: { in: ["ACTIVE", "TRIALING"] } },
        _count: { _all: true },
      }),
      db.billingPlan.findMany({
        where: { active: true },
        orderBy: { version: "desc" },
        distinct: ["plan"],
      }),
    ]);
    let mrr = 0;
    for (const row of subscriptions) {
      const plan = plans.find((candidate) => candidate.plan === row.plan);
      mrr += ((plan?.monthlyPriceCents ?? 0) * row._count._all) / 100;
      await this.repository.replaceSnapshot({
        organizationId,
        metricKey: `plan.${row.plan}`,
        metricValue: row._count._all,
        snapshotDate: date,
      });
    }
    await this.repository.replaceSnapshot({
      organizationId,
      metricKey: "mrr",
      metricValue: mrr,
      snapshotDate: date,
    });
    await this.repository.audit(organizationId, "analytics.snapshot_created", {
      snapshotDate: date.toISOString(),
    });
    return { mrr, planCount: subscriptions.length };
  }
}
