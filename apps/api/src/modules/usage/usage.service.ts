import { Injectable, Logger } from "@nestjs/common";
import type { PlanType, Prisma, UsageResource } from "../../../generated/prisma";
import { RedisService } from "../../redis/redis.service";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { UsageRepository } from "./usage.repository";
import type { TrackUsageInput, UsagePeriod } from "./usage.types";
import { USAGE_RESOURCES } from "./usage.types";

const CACHE_TTL_SECONDS = 60;

export type UsageLimits = Partial<Record<UsageResource, number | null>>;

export interface CurrentUsage {
  periodStart: string;
  periodEnd: string;
  periodSource: UsagePeriod["source"];
  values: Record<UsageResource, number>;
  updatedAt: string | null;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly periodCache = new Map<string, { period: UsagePeriod; expiresAt: number }>();

  constructor(
    private readonly repository: UsageRepository,
    private readonly redis: RedisService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  increment(input: TrackUsageInput) {
    return this.track({ ...input, quantity: Math.abs(input.quantity ?? 1) });
  }

  decrement(input: TrackUsageInput) {
    return this.track({ ...input, quantity: -Math.abs(input.quantity ?? 1) });
  }

  async track(input: TrackUsageInput) {
    const quantity = input.quantity ?? 1;
    if (!Number.isFinite(quantity) || quantity === 0) {
      throw new Error("Usage quantity must be a finite, non-zero number.");
    }
    const period = await this.resolvePeriod(input.organizationId, input.occurredAt);
    const counter = await this.repository.apply(input, period, quantity);
    await this.invalidate(input.organizationId, period.start);
    this.metrics.increment("usage_counter_updates");
    return serializeCounter(counter);
  }

  async getUsage(organizationId: string, period?: UsagePeriod): Promise<CurrentUsage> {
    const resolvedPeriod = period ?? (await this.repository.billingPeriod(organizationId));
    const cached = await this.readCache(organizationId, resolvedPeriod.start);
    if (cached) return cached;
    const counters = await this.repository.counters(organizationId, resolvedPeriod);
    const values = Object.fromEntries(USAGE_RESOURCES.map((resource) => [resource, 0])) as Record<
      UsageResource,
      number
    >;
    for (const counter of counters) values[counter.resourceType] = Number(counter.currentValue);
    const result = {
      periodStart: resolvedPeriod.start.toISOString(),
      periodEnd: resolvedPeriod.end.toISOString(),
      periodSource: resolvedPeriod.source,
      values,
      updatedAt:
        counters
          .reduce<Date | null>(
            (latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest),
            null,
          )
          ?.toISOString() ?? null,
    };
    await this.writeCache(organizationId, resolvedPeriod.start, result);
    return result;
  }

  async getRemaining(organizationId: string, limits: UsageLimits) {
    const usage = await this.getUsage(organizationId);
    return {
      ...usage,
      resources: Object.fromEntries(
        USAGE_RESOURCES.map((resource) => {
          const used = usage.values[resource];
          const limit = limits[resource] ?? null;
          const remaining = limit === null ? null : Math.max(0, limit - used);
          const overage = limit === null ? 0 : Math.max(0, used - limit);
          return [resource, { used, limit, remaining, overage }];
        }),
      ),
    };
  }

  async resetPeriod(organizationId: string, at = new Date()) {
    const period = await this.repository.billingPeriod(organizationId, at);
    await Promise.all(
      USAGE_RESOURCES.map((resourceType) =>
        this.repository.setCounter({ organizationId, resourceType, value: 0, period }),
      ),
    );
    await this.invalidate(organizationId, period.start);
    await this.repository.createAudit({
      organizationId,
      action: "usage.period_reset",
      metadata: { periodStart: period.start, periodEnd: period.end },
    });
    this.metrics.increment("usage_period_resets");
    return this.getUsage(organizationId, period);
  }

  async history(
    organizationId: string,
    input: { page?: number; limit?: number; resourceType?: UsageResource },
  ) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const [total, rows] = await this.repository.history(
      organizationId,
      page,
      limit,
      input.resourceType,
    );
    return {
      total,
      page,
      limit,
      data: rows.map((row) => ({ ...row, quantity: Number(row.quantity) })),
    };
  }

  async periodHistory(organizationId: string) {
    const rows = await this.repository.periodHistory(organizationId);
    return rows.map(serializeCounter);
  }

  async reconcile(organizationId: string) {
    const period = await this.repository.billingPeriod(organizationId);
    const prisma = this.repository.prismaClient();
    const [
      agents,
      calls,
      messages,
      sms,
      storage,
      knowledgeBases,
      appointments,
      phoneNumbers,
      widgets,
      tools,
      externalPhoneNumbers,
      portRequests,
      completedPorts,
      failedPorts,
      callSummaries,
    ] = await Promise.all([
      prisma.agent.count({ where: { organizationId, deletedAt: null } }),
      prisma.call.groupBy({
        by: ["direction"],
        where: { organizationId, startedAt: { gte: period.start, lt: period.end } },
        _count: { _all: true },
        _sum: { durationSeconds: true },
      }),
      prisma.message.count({
        where: {
          organizationId,
          senderType: "ASSISTANT",
          deletedAt: null,
          createdAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.communicationMessage.count({
        where: {
          organizationId,
          direction: "OUTBOUND",
          status: { in: ["SENT", "DELIVERED", "READ"] },
          sentAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.document.aggregate({
        where: { organizationId, uploadStatus: "UPLOADED", deletedAt: null },
        _sum: { fileSize: true },
      }),
      prisma.knowledgeBase.count({ where: { organizationId, deletedAt: null } }),
      prisma.appointment.count({
        where: {
          organizationId,
          status: { not: "CANCELLED" },
          createdAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.phoneNumber.count({ where: { organizationId, deletedAt: null } }),
      prisma.widget.count({ where: { organizationId, deletedAt: null } }),
      prisma.toolExecution.count({
        where: {
          organizationId,
          status: "SUCCESS",
          createdAt: { gte: period.start, lt: period.end },
        },
      }),
      prisma.externalPhoneNumber.count({
        where: { organizationId, status: { not: "DISABLED" } },
      }),
      prisma.portRequest.count({
        where: { organizationId, status: { not: "CANCELLED" } },
      }),
      prisma.portRequest.count({
        where: { organizationId, status: "COMPLETED" },
      }),
      prisma.portRequest.count({
        where: { organizationId, status: { in: ["FAILED", "REJECTED"] } },
      }),
      prisma.callSummary.aggregate({
        where: {
          organizationId,
          generatedAt: { gte: period.start, lt: period.end },
        },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          estimatedCostMicros: true,
        },
      }),
    ]);
    const callSeconds = calls.reduce((sum, row) => sum + (row._sum.durationSeconds ?? 0), 0);
    const values: Partial<Record<UsageResource, number>> = {
      AGENTS: agents,
      AI_MINUTES: Math.ceil(callSeconds / 60),
      REALTIME_VOICE_MINUTES: Math.ceil(callSeconds / 60),
      INCOMING_CALLS: calls.find((row) => row.direction === "INBOUND")?._count._all ?? 0,
      OUTGOING_CALLS: calls.find((row) => row.direction === "OUTBOUND")?._count._all ?? 0,
      MESSAGES: messages,
      SMS_MESSAGES: sms,
      KNOWLEDGE_STORAGE_MB: Number(((storage._sum.fileSize ?? 0) / 1_048_576).toFixed(6)),
      KNOWLEDGE_BASES: knowledgeBases,
      APPOINTMENTS: appointments,
      PHONE_NUMBERS: phoneNumbers,
      WIDGETS: widgets,
      TOOL_EXECUTIONS: tools,
      EXTERNAL_PHONE_NUMBERS: externalPhoneNumbers,
      PORT_REQUESTS: portRequests,
      COMPLETED_PORTS: completedPorts,
      FAILED_PORTS: failedPorts,
      AI_SUMMARY_GENERATIONS: callSummaries._count._all,
      AI_SUMMARY_INPUT_TOKENS: callSummaries._sum.inputTokens ?? 0,
      AI_SUMMARY_OUTPUT_TOKENS: callSummaries._sum.outputTokens ?? 0,
      AI_SUMMARY_COST_MICROS: callSummaries._sum.estimatedCostMicros ?? 0,
    };
    await Promise.all(
      Object.entries(values).map(([resourceType, value]) =>
        this.repository.setCounter({
          organizationId,
          resourceType: resourceType as UsageResource,
          value,
          period,
        }),
      ),
    );
    await this.invalidate(organizationId, period.start);
    await this.repository.createAudit({
      organizationId,
      action: "usage.reconciled",
      metadata: { resourceCount: Object.keys(values).length },
    });
    return values;
  }

  activeOrganizationIds() {
    return this.repository.activeOrganizationIds();
  }

  async manualAdjustment(input: TrackUsageInput & { actorUserId?: string }) {
    const result = await this.track(input);
    await this.repository.createAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "usage.manual_adjustment",
      resourceType: input.resourceType,
      metadata: { quantity: input.quantity ?? 1 },
    });
    return result;
  }

  private cacheKey(organizationId: string, periodStart: Date) {
    return `usage:v1:${organizationId}:${periodStart.toISOString()}`;
  }

  private async resolvePeriod(organizationId: string, occurredAt?: Date) {
    if (occurredAt) return this.repository.billingPeriod(organizationId, occurredAt);
    const cached = this.periodCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now() && cached.period.end > new Date()) {
      return cached.period;
    }
    const period = await this.repository.billingPeriod(organizationId);
    if (this.periodCache.size >= 10_000) {
      this.periodCache.delete(this.periodCache.keys().next().value as string);
    }
    this.periodCache.set(organizationId, { period, expiresAt: Date.now() + 60_000 });
    return period;
  }

  private async invalidate(organizationId: string, periodStart: Date) {
    if (!this.redis.isAvailable) return;
    try {
      await this.redis.cache.del(this.cacheKey(organizationId, periodStart));
    } catch (error) {
      this.logger.warn(`Usage cache invalidation failed: ${safeError(error)}`);
    }
  }

  private async readCache(organizationId: string, periodStart: Date): Promise<CurrentUsage | null> {
    if (!this.redis.isAvailable) return null;
    try {
      const value = await this.redis.cache.get(this.cacheKey(organizationId, periodStart));
      this.metrics.increment(value ? "usage_cache_hits" : "usage_cache_misses");
      return value ? (JSON.parse(value) as CurrentUsage) : null;
    } catch (error) {
      this.logger.warn(`Usage cache read failed: ${safeError(error)}`);
      return null;
    }
  }

  private async writeCache(organizationId: string, periodStart: Date, value: unknown) {
    if (!this.redis.isAvailable) return;
    try {
      await this.redis.cache.set(
        this.cacheKey(organizationId, periodStart),
        JSON.stringify(value),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`Usage cache write failed: ${safeError(error)}`);
    }
  }
}

function serializeCounter(
  counter: {
    id: string;
    organizationId: string;
    resourceType: UsageResource;
    currentValue: Prisma.Decimal;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    version: number;
    updatedAt: Date;
  } | null,
) {
  return counter ? { ...counter, currentValue: Number(counter.currentValue) } : null;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

export function usageLimitsForPlan(
  plan: PlanType,
  limits: {
    agents: number | null;
    voiceMinutes: number | null;
    sms: number | null;
    chatMessages: number | null;
    knowledgeBases: number | null;
    phoneNumbers: number | null;
    widgets: number | null;
  },
): UsageLimits {
  void plan;
  return {
    AI_MINUTES: limits.voiceMinutes,
    REALTIME_VOICE_MINUTES: limits.voiceMinutes,
    MESSAGES: limits.chatMessages,
    SMS_MESSAGES: limits.sms,
    AGENTS: limits.agents,
    KNOWLEDGE_BASES: limits.knowledgeBases,
    PHONE_NUMBERS: limits.phoneNumbers,
    WIDGETS: limits.widgets,
  };
}
