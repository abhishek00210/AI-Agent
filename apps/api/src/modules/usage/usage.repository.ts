import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma, type UsageResource } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import type { TrackUsageInput, UsagePeriod } from "./usage.types";

@Injectable()
export class UsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async billingPeriod(organizationId: string, at = new Date()): Promise<UsagePeriod> {
    const context = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        trialStartsAt: true,
        trialEndsAt: true,
        trialStatus: true,
        subscriptions: {
          where: {
            currentPeriodStart: { lte: at },
            currentPeriodEnd: { gt: at },
          },
          orderBy: { currentPeriodEnd: "desc" },
          take: 1,
          select: { currentPeriodStart: true, currentPeriodEnd: true },
        },
      },
    });
    if (!context) throw new Error("Organization not found while resolving usage period.");
    const subscription = context.subscriptions[0];
    if (subscription) {
      return {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
        source: "SUBSCRIPTION",
      };
    }
    if (
      context.trialStatus === "ACTIVE" &&
      context.trialStartsAt &&
      context.trialEndsAt &&
      context.trialStartsAt <= at &&
      context.trialEndsAt > at
    ) {
      return { start: context.trialStartsAt, end: context.trialEndsAt, source: "TRIAL" };
    }
    return { start: monthStart(at), end: nextMonthStart(at), source: "CALENDAR" };
  }

  async apply(input: TrackUsageInput, period: UsagePeriod, delta: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        organizationId: string;
        resourceType: UsageResource;
        currentValue: Prisma.Decimal;
        billingPeriodStart: Date;
        billingPeriodEnd: Date;
        version: number;
        updatedAt: Date;
      }>
    >`
      WITH inserted_event AS (
        INSERT INTO "usage_events"
          ("id", "organizationId", "resourceType", "quantity", "idempotencyKey", "metadata", "createdAt")
        VALUES
          (${randomUUID()}, ${input.organizationId}, ${input.resourceType}::"UsageResource", ${delta}, ${input.idempotencyKey ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.occurredAt ?? new Date()})
        ON CONFLICT ("organizationId", "idempotencyKey") DO NOTHING
        RETURNING 1
      ), upserted_counter AS (
        INSERT INTO "usage_counters"
          ("id", "organizationId", "resourceType", "currentValue", "billingPeriodStart", "billingPeriodEnd", "version", "updatedAt")
        SELECT
          ${randomUUID()}, ${input.organizationId}, ${input.resourceType}::"UsageResource", ${delta}, ${period.start}, ${period.end}, 1, NOW()
        WHERE EXISTS (SELECT 1 FROM inserted_event)
        ON CONFLICT ("organizationId", "resourceType", "billingPeriodStart")
        DO UPDATE SET
          "currentValue" = GREATEST(0, "usage_counters"."currentValue" + ${delta}),
          "billingPeriodEnd" = EXCLUDED."billingPeriodEnd",
          "version" = "usage_counters"."version" + 1,
          "updatedAt" = NOW()
        RETURNING *
      )
      SELECT * FROM upserted_counter
      UNION ALL
      SELECT * FROM "usage_counters"
      WHERE "organizationId" = ${input.organizationId}
        AND "resourceType" = ${input.resourceType}::"UsageResource"
        AND "billingPeriodStart" = ${period.start}
        AND NOT EXISTS (SELECT 1 FROM upserted_counter)
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  counter(organizationId: string, resourceType: UsageResource, periodStart: Date) {
    return this.prisma.usageCounter.findUnique({
      where: {
        organizationId_resourceType_billingPeriodStart: {
          organizationId,
          resourceType,
          billingPeriodStart: periodStart,
        },
      },
    });
  }

  counters(organizationId: string, period: UsagePeriod) {
    return this.prisma.usageCounter.findMany({
      where: { organizationId, billingPeriodStart: period.start },
      orderBy: { resourceType: "asc" },
    });
  }

  history(organizationId: string, page: number, limit: number, resourceType?: UsageResource) {
    const where = { organizationId, ...(resourceType ? { resourceType } : {}) };
    return this.prisma.$transaction([
      this.prisma.usageEvent.count({ where }),
      this.prisma.usageEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  }

  periodHistory(organizationId: string, limit = 12) {
    return this.prisma.usageCounter.findMany({
      where: { organizationId },
      orderBy: [{ billingPeriodStart: "desc" }, { resourceType: "asc" }],
      take: limit * 20,
    });
  }

  setCounter(input: {
    organizationId: string;
    resourceType: UsageResource;
    value: number;
    period: UsagePeriod;
  }) {
    return this.prisma.usageCounter.upsert({
      where: {
        organizationId_resourceType_billingPeriodStart: {
          organizationId: input.organizationId,
          resourceType: input.resourceType,
          billingPeriodStart: input.period.start,
        },
      },
      update: {
        currentValue: input.value,
        billingPeriodEnd: input.period.end,
        version: { increment: 1 },
      },
      create: {
        organizationId: input.organizationId,
        resourceType: input.resourceType,
        currentValue: input.value,
        billingPeriodStart: input.period.start,
        billingPeriodEnd: input.period.end,
      },
    });
  }

  activeOrganizationIds() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
  }

  createAudit(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    resourceType?: UsageResource;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: "UsageCounter",
        entityId: input.resourceType,
        metadata: input.metadata,
      },
    });
  }

  prismaClient() {
    return this.prisma;
  }
}

function monthStart(at: Date) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

function nextMonthStart(at: Date) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}
