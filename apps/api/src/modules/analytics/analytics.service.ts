import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
import { AnalyticsRepository } from "./analytics.repository";
import type { AnalyticsEventInput, AnalyticsRange } from "./analytics.types";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly redis: RedisService,
  ) {}

  capabilities() {
    return {
      resource: "analytics",
      mode: "snapshot-driven",
      liveTableScans: false,
      cacheTtlSeconds: 60,
      definitions: analyticsDefinitions(),
    };
  }

  async record(input: AnalyticsEventInput) {
    const event = await this.repository.createEvent(input);
    if (!event) return { duplicate: true };
    await this.repository.applyEvent(event);
    await this.invalidate(input.organizationId);
    return { duplicate: false, eventId: event.id };
  }

  async dashboard(organizationId: string, range: AnalyticsRange) {
    const key = cacheKey(organizationId, range, await this.cacheVersion(organizationId));
    const cached = await this.readCache(key);
    if (cached) return cached;
    const [daily, agents, activity, snapshots] = await Promise.all([
      this.repository.daily(organizationId, range),
      this.repository.topAgents(organizationId, range),
      this.repository.recentActivity(organizationId, range),
      this.repository.snapshots(organizationId, range),
    ]);
    const totals = daily.reduce((result, row) => {
      result.totalCalls += row.totalCalls;
      result.incomingCalls += row.incomingCalls;
      result.outgoingCalls += row.outgoingCalls;
      result.appointments += row.appointments;
      result.leads += row.leads;
      result.qualifiedLeads += row.qualifiedLeads;
      result.aiMinutes += Number(row.aiMinutes);
      result.smsSent += row.smsSent;
      result.messagesSent += row.messagesSent;
      result.revenue += Number(row.revenue);
      result.callDurationSeconds += row.callDurationSeconds;
      result.aiResponses += row.aiResponses;
      result.aiTokens += Number(row.aiInputTokens + row.aiOutputTokens);
      result.toolExecutions += row.toolExecutions;
      result.appointmentsBookedByAi += row.appointmentsBookedByAi;
      result.leadsCreatedByAi += row.leadsCreatedByAi;
      result.newCustomers += row.newCustomers;
      result.returningCustomers += row.returningCustomers;
      result.recognizedCallers += row.recognizedCallers;
      result.memoryContextLoads += row.memoryContextLoads;
      result.personalizedGreetings += row.personalizedGreetings;
      result.greetingLevel0 = (result.greetingLevel0 ?? 0) + row.greetingLevel0;
      result.greetingLevel1 = (result.greetingLevel1 ?? 0) + row.greetingLevel1;
      result.greetingLevel2 = (result.greetingLevel2 ?? 0) + row.greetingLevel2;
      result.greetingLevel3 = (result.greetingLevel3 ?? 0) + row.greetingLevel3;
      result.repeatCallers += row.repeatCallers;
      return result;
    }, emptyTotals());
    const result = {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      definitions: analyticsDefinitions(),
      overview: {
        ...totals,
        conversionRate: totals.leads ? (totals.appointments / totals.leads) * 100 : 0,
        averageCallDuration: totals.totalCalls ? totals.callDurationSeconds / totals.totalCalls : 0,
        customerRetentionRate:
          totals.newCustomers + totals.returningCustomers
            ? (totals.returningCustomers / (totals.newCustomers + totals.returningCustomers)) * 100
            : 0,
      },
      series: daily.map((row) => ({
        date: row.date.toISOString(),
        calls: row.totalCalls,
        leads: row.leads,
        appointments: row.appointments,
        revenue: Number(row.revenue),
        aiMinutes: Number(row.aiMinutes),
      })),
      topAgents: agents.map((row) => {
        const calls = row._sum.calls ?? 0;
        const appointments = row._sum.appointments ?? 0;
        const leads = row._sum.leads ?? 0;
        return {
          agentId: row.agentId,
          agentName: row.agentName,
          calls,
          appointments,
          leads,
          conversionRate: leads ? (appointments / leads) * 100 : 0,
        };
      }),
      recentActivity: activity.map((event) => ({
        ...event,
        title: activityTitle(event.eventType),
        metadata: safeActivityMetadata(event.metadata),
      })),
      revenue: {
        total: totals.revenue,
        mrr: latestSnapshot(snapshots, "mrr"),
        planDistribution: Object.fromEntries(
          snapshots
            .filter((row) => row.metricKey.startsWith("plan."))
            .map((row) => [row.metricKey.slice(5), Number(row.metricValue)]),
        ),
      },
    };
    await this.writeCache(key, result);
    await this.auditGenerated(organizationId, result.range);
    return result;
  }

  async invalidate(organizationId: string) {
    if (!this.redis.isAvailable) return;
    try {
      await this.redis.cache.incr(`analytics:version:${organizationId}`);
    } catch (error) {
      this.logger.warn(
        `Analytics cache invalidation failed: ${error instanceof Error ? error.name : "UnknownError"}`,
      );
    }
  }

  resolveRange(input: { range?: string; from?: string; to?: string }): AnalyticsRange {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    let from: Date;
    let to = tomorrow;
    if (input.range === "CUSTOM") {
      if (!input.from || !input.to)
        throw new BadRequestException("Custom range requires from and to dates.");
      from = day(new Date(input.from));
      to = new Date(day(new Date(input.to)).getTime() + 86_400_000);
    } else {
      const days = input.range === "TODAY" ? 1 : input.range === "7D" ? 7 : 30;
      from = new Date(to.getTime() - days * 86_400_000);
    }
    if (from >= to || to.getTime() - from.getTime() > 366 * 86_400_000)
      throw new BadRequestException("Analytics range must be between 1 and 366 days.");
    return { from, to };
  }

  private async readCache(key: string) {
    if (!this.redis.isAvailable) return null;
    try {
      const value = await this.redis.cache.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }
  private async cacheVersion(organizationId: string) {
    if (!this.redis.isAvailable) return "0";
    try {
      return (await this.redis.cache.get(`analytics:version:${organizationId}`)) ?? "0";
    } catch {
      return "0";
    }
  }
  private async auditGenerated(organizationId: string, range: { from: string; to: string }) {
    if (!this.redis.isAvailable) return;
    try {
      const acquired = await this.redis.cache.set(
        `analytics:audit:${organizationId}`,
        "1",
        "EX",
        3600,
        "NX",
      );
      if (acquired) await this.repository.audit(organizationId, "analytics.generated", range);
    } catch {
      /* analytics reads remain available */
    }
  }
  private async writeCache(key: string, value: unknown) {
    if (!this.redis.isAvailable) return;
    try {
      await this.redis.cache.set(key, JSON.stringify(value), "EX", 60);
    } catch {
      /* DB result remains authoritative */
    }
  }
}

function emptyTotals() {
  return {
    totalCalls: 0,
    incomingCalls: 0,
    outgoingCalls: 0,
    appointments: 0,
    leads: 0,
    qualifiedLeads: 0,
    aiMinutes: 0,
    smsSent: 0,
    messagesSent: 0,
    revenue: 0,
    callDurationSeconds: 0,
    aiResponses: 0,
    aiTokens: 0,
    toolExecutions: 0,
    appointmentsBookedByAi: 0,
    leadsCreatedByAi: 0,
    newCustomers: 0,
    returningCustomers: 0,
    recognizedCallers: 0,
    memoryContextLoads: 0,
    personalizedGreetings: 0,
    greetingLevel0: 0,
    greetingLevel1: 0,
    greetingLevel2: 0,
    greetingLevel3: 0,
    repeatCallers: 0,
  };
}
function analyticsDefinitions() {
  return {
    conversionRate:
      "appointments / leads * 100 for the selected date range. Cancelled appointments and deleted leads are excluded. Qualified-lead and closed-deal conversion are separate future metrics.",
    revenue:
      "recognized cash revenue from verified Stripe invoice.payment_succeeded amount_paid events in the selected range. Proration credits and charges are represented by the Stripe invoice amount.",
    mrr: "active subscription monthly recurring revenue snapshot from the current versioned billing-plan price.",
  };
}
function day(value: Date) {
  if (Number.isNaN(value.getTime())) throw new BadRequestException("Invalid analytics date.");
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function cacheKey(org: string, range: AnalyticsRange, version: string) {
  return `analytics:v1:${org}:${version}:${range.from.toISOString()}:${range.to.toISOString()}`;
}
function latestSnapshot(
  rows: Array<{ metricKey: string; metricValue: { toString(): string }; snapshotDate: Date }>,
  key: string,
) {
  return Number([...rows].reverse().find((row) => row.metricKey === key)?.metricValue ?? 0);
}
function activityTitle(type: string) {
  return (
    (
      {
        LEAD_CREATED: "New lead",
        APPOINTMENT_CREATED: "Appointment booked",
        SMS_SENT: "SMS sent",
        AI_SUMMARY_GENERATED: "AI call summary generated",
        SUBSCRIPTION_UPDATED: "Subscription updated",
      } as Record<string, string>
    )[type] ?? "Activity"
  );
}
function safeActivityMetadata(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return {
    source: typeof row.source === "string" ? row.source : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    agentName: typeof row.agentName === "string" ? row.agentName : undefined,
    plan: typeof row.plan === "string" ? row.plan : undefined,
    intent: typeof row.intent === "string" ? row.intent : undefined,
    sentiment: typeof row.sentiment === "string" ? row.sentiment : undefined,
    outcome: typeof row.outcome === "string" ? row.outcome : undefined,
  };
}
