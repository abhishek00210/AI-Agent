import { Injectable } from "@nestjs/common";
import { Prisma, type AnalyticsDailyMetric } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import type { AnalyticsEventInput, AnalyticsRange } from "./analytics.types";

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(input: AnalyticsEventInput) {
    try {
      return await this.prisma.analyticsEvent.create({
        data: {
          organizationId: input.organizationId,
          eventType: input.eventType,
          idempotencyKey: input.idempotencyKey,
          agentId: input.agentId,
          metricDate: day(input.occurredAt ?? new Date()),
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return null;
      throw error;
    }
  }

  async applyEvent(event: {
    id: string;
    organizationId: string;
    eventType: string;
    agentId: string | null;
    metricDate: Date;
    metadata: Prisma.JsonValue;
  }) {
    const delta = eventDelta(event.eventType, event.metadata);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.analyticsDailyMetric.upsert({
        where: {
          organizationId_date: { organizationId: event.organizationId, date: event.metricDate },
        },
        create: {
          organizationId: event.organizationId,
          date: event.metricDate,
          ...delta.create,
        } as Prisma.AnalyticsDailyMetricUncheckedCreateInput,
        update: delta.update as Prisma.AnalyticsDailyMetricUncheckedUpdateInput,
      });
      const next = applyNumericDelta(current, delta.numeric);
      await tx.analyticsDailyMetric.update({
        where: { id: current.id },
        data: derived(next),
      });
      if (event.agentId && delta.agent) {
        await tx.analyticsAgentDailyMetric.upsert({
          where: {
            organizationId_agentId_date: {
              organizationId: event.organizationId,
              agentId: event.agentId,
              date: event.metricDate,
            },
          },
          create: {
            organizationId: event.organizationId,
            agentId: event.agentId,
            agentName: text(event.metadata, "agentName") ?? "Agent",
            date: event.metricDate,
            ...delta.agent,
          },
          update: {
            calls: { increment: delta.agent.calls },
            appointments: { increment: delta.agent.appointments },
            leads: { increment: delta.agent.leads },
            ...(text(event.metadata, "agentName")
              ? { agentName: text(event.metadata, "agentName")! }
              : {}),
          },
        });
      }
      await tx.analyticsEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    });
  }

  daily(organizationId: string, range: AnalyticsRange) {
    return this.prisma.analyticsDailyMetric.findMany({
      where: { organizationId, date: { gte: range.from, lt: range.to } },
      orderBy: { date: "asc" },
    });
  }

  topAgents(organizationId: string, range: AnalyticsRange) {
    return this.prisma.analyticsAgentDailyMetric.groupBy({
      by: ["agentId", "agentName"],
      where: { organizationId, date: { gte: range.from, lt: range.to } },
      _sum: { calls: true, appointments: true, leads: true },
      orderBy: { _sum: { calls: "desc" } },
      take: 10,
    });
  }

  recentActivity(organizationId: string, range: AnalyticsRange) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        organizationId,
        metricDate: { gte: range.from, lt: range.to },
        eventType: {
          in: [
            "LEAD_CREATED",
            "APPOINTMENT_CREATED",
            "SMS_SENT",
            "AI_SUMMARY_GENERATED",
            "SUBSCRIPTION_UPDATED",
          ],
        },
      },
      select: {
        id: true,
        eventType: true,
        agentId: true,
        metricDate: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  unprocessedEvents(limit = 500) {
    return this.prisma.analyticsEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  snapshots(organizationId: string, range: AnalyticsRange) {
    return this.prisma.analyticsMetricSnapshot.findMany({
      where: { organizationId, snapshotDate: { gte: range.from, lt: range.to } },
      orderBy: { snapshotDate: "asc" },
    });
  }

  upsertDaily(
    organizationId: string,
    date: Date,
    data: Omit<
      Prisma.AnalyticsDailyMetricUncheckedCreateInput,
      "id" | "organizationId" | "date" | "createdAt" | "updatedAt"
    >,
  ) {
    return this.prisma.analyticsDailyMetric.upsert({
      where: { organizationId_date: { organizationId, date } },
      create: { organizationId, date, ...data },
      update: data,
    });
  }

  upsertAgentDaily(input: {
    organizationId: string;
    agentId: string;
    agentName: string;
    date: Date;
    calls: number;
    appointments: number;
    leads: number;
  }) {
    return this.prisma.analyticsAgentDailyMetric.upsert({
      where: {
        organizationId_agentId_date: {
          organizationId: input.organizationId,
          agentId: input.agentId,
          date: input.date,
        },
      },
      create: input,
      update: input,
    });
  }

  async replaceAgentDaily(
    organizationId: string,
    date: Date,
    rows: Array<{
      agentId: string;
      agentName: string;
      calls: number;
      appointments: number;
      leads: number;
    }>,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.analyticsAgentDailyMetric.deleteMany({ where: { organizationId, date } });
      if (!rows.length) return;
      await tx.analyticsAgentDailyMetric.createMany({
        data: rows.map((row) => ({ organizationId, date, ...row })),
        skipDuplicates: true,
      });
    });
  }

  replaceSnapshot(input: {
    organizationId: string;
    metricKey: string;
    metricValue: number;
    snapshotDate: Date;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.analyticsMetricSnapshot.upsert({
      where: {
        organizationId_metricKey_snapshotDate: {
          organizationId: input.organizationId,
          metricKey: input.metricKey,
          snapshotDate: input.snapshotDate,
        },
      },
      create: input,
      update: { metricValue: input.metricValue, metadata: input.metadata },
    });
  }

  organizations() {
    return this.prisma.organization.findMany({ where: { deletedAt: null }, select: { id: true } });
  }
  client() {
    return this.prisma;
  }
  audit(organizationId: string, action: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditEvent.create({
      data: { organizationId, action, entityType: "Analytics", metadata },
    });
  }
}

function eventDelta(type: string, metadata: Prisma.JsonValue) {
  const direction = text(metadata, "direction");
  const duration = number(metadata, "durationSeconds");
  const revenue = number(metadata, "revenue");
  const aiMinutes = number(metadata, "aiMinutes");
  const inputTokens = number(metadata, "inputTokens");
  const outputTokens = number(metadata, "outputTokens");
  const greetingLevel = number(metadata, "level");
  const source = text(metadata, "source");
  const numeric: Record<string, number> = {};
  if (type === "CALL_STARTED")
    Object.assign(numeric, {
      totalCalls: 1,
      incomingCalls: direction === "INBOUND" ? 1 : 0,
      outgoingCalls: direction === "OUTBOUND" ? 1 : 0,
    });
  if (type === "CALL_DURATION")
    Object.assign(numeric, { callDurationSeconds: duration, aiMinutes });
  if (type === "LEAD_CREATED")
    Object.assign(numeric, {
      leads: 1,
      leadsCreatedByAi:
        source === "AI_AGENT" || source === "VOICE" || source === "CHAT" || source === "WIDGET"
          ? 1
          : 0,
    });
  if (type === "APPOINTMENT_CREATED")
    Object.assign(numeric, {
      appointments: 1,
      appointmentsBookedByAi: source !== "MANUAL" ? 1 : 0,
    });
  if (type === "SMS_SENT") Object.assign(numeric, { smsSent: 1 });
  if (type === "AI_RESPONSE")
    Object.assign(numeric, {
      aiResponses: 1,
      messagesSent: 1,
      aiInputTokens: inputTokens,
      aiOutputTokens: outputTokens,
    });
  if (type === "TOOL_EXECUTION") Object.assign(numeric, { toolExecutions: 1 });
  if (type === "CALLER_RECOGNIZED") Object.assign(numeric, { recognizedCallers: 1 });
  if (type === "MEMORY_CONTEXT_LOADED") Object.assign(numeric, { memoryContextLoads: 1 });
  if (type === "PERSONALIZED_GREETING") Object.assign(numeric, { personalizedGreetings: 1 });
  if (type === "GREETING_GENERATED") {
    Object.assign(numeric, {
      personalizedGreetings: greetingLevel > 0 ? 1 : 0,
      greetingLevel0: greetingLevel === 0 ? 1 : 0,
      greetingLevel1: greetingLevel === 1 ? 1 : 0,
      greetingLevel2: greetingLevel === 2 ? 1 : 0,
      greetingLevel3: greetingLevel === 3 ? 1 : 0,
    });
  }
  if (type === "BILLING_PAYMENT") Object.assign(numeric, { revenue });
  const create = Object.fromEntries(Object.entries(numeric));
  const update = Object.fromEntries(
    Object.entries(numeric).map(([key, value]) => [key, { increment: value }]),
  );
  const agent =
    type === "CALL_STARTED"
      ? { calls: 1, appointments: 0, leads: 0 }
      : type === "LEAD_CREATED"
        ? { calls: 0, appointments: 0, leads: 1 }
        : type === "APPOINTMENT_CREATED"
          ? { calls: 0, appointments: 1, leads: 0 }
          : null;
  return { create, update, numeric, agent };
}

function applyNumericDelta(current: AnalyticsDailyMetric, delta: Record<string, number>) {
  return {
    ...current,
    totalCalls: current.totalCalls + (delta.totalCalls ?? 0),
    incomingCalls: current.incomingCalls + (delta.incomingCalls ?? 0),
    outgoingCalls: current.outgoingCalls + (delta.outgoingCalls ?? 0),
    appointments: current.appointments + (delta.appointments ?? 0),
    leads: current.leads + (delta.leads ?? 0),
    callDurationSeconds: current.callDurationSeconds + (delta.callDurationSeconds ?? 0),
  };
}

function derived(
  current: Pick<
    AnalyticsDailyMetric,
    "totalCalls" | "callDurationSeconds" | "leads" | "appointments"
  >,
) {
  const calls = current.totalCalls;
  const duration = current.callDurationSeconds;
  const leads = current.leads;
  const appointments = current.appointments;
  return {
    avgCallDuration: calls ? duration / calls : 0,
    conversionRate: leads ? (appointments / leads) * 100 : 0,
  };
}
function day(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function number(value: Prisma.JsonValue, key: string) {
  return value &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    typeof value[key] === "number"
    ? (value[key] as number)
    : 0;
}
function text(value: Prisma.JsonValue, key: string) {
  return value &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    typeof value[key] === "string"
    ? (value[key] as string)
    : null;
}
