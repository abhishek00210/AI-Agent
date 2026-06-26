import { Injectable } from "@nestjs/common";
import type { CallDirection } from "../../../generated/prisma";
import { AnalyticsRepository } from "./analytics.repository";

@Injectable()
export class AnalyticsAggregationService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async reconcileDay(organizationId: string, date: Date) {
    const from = utcDay(date);
    const to = new Date(from.getTime() + 86_400_000);
    const db = this.repository.client();
    const [
      calls,
      sessionDuration,
      appointments,
      leads,
      sms,
      usage,
      revenue,
      agentCalls,
      agentAppointments,
      agentLeads,
    ] = await Promise.all([
      db.call.groupBy({
        by: ["direction"],
        where: { organizationId, startedAt: { gte: from, lt: to } },
        _count: { _all: true },
        _sum: { durationSeconds: true },
      }),
      db.$queryRaw<Array<{ seconds: number }>>`
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("disconnectedAt" - "connectedAt"))), 0)::float8 AS seconds
        FROM call_sessions
        WHERE "organizationId" = ${organizationId}
          AND "connectedAt" >= ${from} AND "connectedAt" < ${to}
          AND "disconnectedAt" IS NOT NULL
      `,
      db.appointment.groupBy({
        by: ["source"],
        where: { organizationId, createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
        _count: { _all: true },
      }),
      db.lead.groupBy({
        by: ["source", "status"],
        where: { organizationId, createdAt: { gte: from, lt: to }, deletedAt: null },
        _count: { _all: true },
      }),
      db.communicationMessage.count({
        where: {
          organizationId,
          sentAt: { gte: from, lt: to },
          status: { in: ["SENT", "DELIVERED", "READ"] },
        },
      }),
      db.usageEvent.groupBy({
        by: ["resourceType"],
        where: { organizationId, createdAt: { gte: from, lt: to } },
        _sum: { quantity: true },
      }),
      db.$queryRaw<
        Array<{ value: number }>
      >`SELECT COALESCE(SUM(NULLIF(payload #>> '{data,object,amount_paid}', '')::numeric), 0) / 100 AS value FROM billing_events WHERE "organizationId" = ${organizationId} AND "eventType" = 'invoice.payment_succeeded' AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
      db.call.groupBy({
        by: ["agentId"],
        where: { organizationId, startedAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
      db.appointment.groupBy({
        by: ["agentId"],
        where: { organizationId, createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
        _count: { _all: true },
      }),
      db.lead.groupBy({
        by: ["agentId"],
        where: {
          organizationId,
          createdAt: { gte: from, lt: to },
          deletedAt: null,
          agentId: { not: null },
        },
        _count: { _all: true },
      }),
    ]);
    const totalCalls = sum(calls, (row) => row._count._all);
    const duration = Math.round(
      Number(sessionDuration[0]?.seconds ?? sum(calls, (row) => row._sum.durationSeconds ?? 0)),
    );
    const leadCount = sum(leads, (row) => row._count._all);
    const appointmentCount = sum(appointments, (row) => row._count._all);
    const usageValue = (resource: string) =>
      Number(usage.find((row) => row.resourceType === resource)?._sum.quantity ?? 0);
    await this.repository.upsertDaily(organizationId, from, {
      totalCalls,
      incomingCalls: callsFor(calls, "INBOUND"),
      outgoingCalls: callsFor(calls, "OUTBOUND"),
      outboundAnsweredCalls: 0,
      outboundConversions: 0,
      appointments: appointmentCount,
      appointmentsBookedByAi: sum(
        appointments.filter((row) => row.source !== "MANUAL"),
        (row) => row._count._all,
      ),
      leads: leadCount,
      leadsCreatedByAi: sum(
        leads.filter((row) => ["AI_AGENT", "VOICE", "CHAT", "WIDGET"].includes(row.source)),
        (row) => row._count._all,
      ),
      qualifiedLeads: sum(
        leads.filter((row) => ["QUALIFIED", "BOOKED", "CUSTOMER"].includes(row.status)),
        (row) => row._count._all,
      ),
      customers: sum(
        leads.filter((row) => row.status === "CUSTOMER"),
        (row) => row._count._all,
      ),
      newCustomers: sum(
        leads.filter((row) => row.status === "CUSTOMER"),
        (row) => row._count._all,
      ),
      returningCustomers: 0,
      repeatCallers: 0,
      conversionRate: leadCount ? (appointmentCount / leadCount) * 100 : 0,
      customerRetentionRate: 0,
      outboundAnswerRate: 0,
      outboundConversionRate: 0,
      followupSuccessRate: 0,
      aiMinutes: usageValue("AI_MINUTES") || Math.ceil(duration / 60),
      aiResponses: usageValue("MESSAGES"),
      aiInputTokens: BigInt(Math.trunc(usageValue("AI_INPUT_TOKENS"))),
      aiOutputTokens: BigInt(Math.trunc(usageValue("AI_OUTPUT_TOKENS"))),
      toolExecutions: usageValue("TOOL_EXECUTIONS"),
      smsSent: sms,
      messagesSent: usageValue("MESSAGES"),
      revenue: Number(revenue[0]?.value ?? 0),
      callDurationSeconds: duration,
      avgCallDuration: totalCalls ? duration / totalCalls : 0,
    });
    const agentIds = new Set([
      ...agentCalls.map((x) => x.agentId),
      ...agentAppointments.map((x) => x.agentId),
      ...agentLeads.map((x) => x.agentId).filter(Boolean),
    ] as string[]);
    const names = await db.agent.findMany({
      where: { organizationId, id: { in: [...agentIds] } },
      select: { id: true, name: true },
    });
    await this.repository.replaceAgentDaily(
      organizationId,
      from,
      [...agentIds].map((agentId) => ({
        agentId,
        agentName: names.find((x) => x.id === agentId)?.name ?? "Agent",
        calls: agentCalls.find((x) => x.agentId === agentId)?._count._all ?? 0,
        appointments: agentAppointments.find((x) => x.agentId === agentId)?._count._all ?? 0,
        leads: agentLeads.find((x) => x.agentId === agentId)?._count._all ?? 0,
      })),
    );
    await this.repository.audit(organizationId, "analytics.reconciliation_run", {
      date: from.toISOString(),
    });
  }

  async backfill(organizationId: string, from: Date, to: Date) {
    for (let date = utcDay(from); date < to; date = new Date(date.getTime() + 86_400_000))
      await this.reconcileDay(organizationId, date);
    await this.repository.audit(organizationId, "analytics.backfill_run", {
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }
}

function utcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function sum<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((total, row) => total + value(row), 0);
}
function callsFor(
  rows: Array<{ direction: CallDirection; _count: { _all: number } }>,
  direction: CallDirection,
) {
  return rows.find((row) => row.direction === direction)?._count._all ?? 0;
}
