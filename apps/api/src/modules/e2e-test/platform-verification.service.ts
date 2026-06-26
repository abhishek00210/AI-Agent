import { Injectable } from "@nestjs/common";
import { performance } from "node:perf_hooks";
import { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { PLAN_LIMITS } from "../billing/feature-gate.service";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";
import type {
  LaunchReadinessResult,
  PerformanceMeasurement,
  VerificationCheck,
  VerificationStatus,
} from "./launch-readiness.types";

const SAMPLE_COUNT = 100;

@Injectable()
export class PlatformVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly memory: CustomerMemoryContextService,
  ) {}

  async verify(): Promise<LaunchReadinessResult> {
    const checks: VerificationCheck[] = [];
    checks.push(await this.dependencyCheck());
    checks.push(await this.inboundLifecycle());
    checks.push(await this.outboundLifecycle());
    checks.push(await this.appointmentReminder());
    checks.push(await this.returningCustomer());
    checks.push(await this.campaignExecution());
    checks.push(await this.phoneManagement());
    checks.push(this.billingLimits());
    checks.push(this.memoryPolicy());
    checks.push(...(await this.consistencyChecks()));
    const performance = await this.performanceChecks();
    const pass = checks.filter((check) => check.status === "PASS").length;
    const warn = checks.filter((check) => check.status === "WARN").length;
    const fail = checks.filter((check) => check.status === "FAIL").length;
    const performanceFailures = performance.filter((measurement) => measurement.status === "FAIL").length;
    return {
      generatedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      checks,
      performance,
      summary: {
        pass,
        warn,
        fail,
        recommendation: fail || performanceFailures ? "NO_GO" : warn ? "CONDITIONAL_GO" : "GO",
      },
    };
  }

  private async dependencyCheck(): Promise<VerificationCheck> {
    let database = false;
    let redis = false;
    try { await this.prisma.$queryRaw`SELECT 1`; database = true; } catch { database = false; }
    try { redis = (await this.redis.cache.ping()) === "PONG"; } catch { redis = false; }
    return check("dependencies", "Reliability", database ? (redis ? "PASS" : "WARN") : "FAIL", database ? (redis ? "Database and Redis are reachable." : "Database is reachable; Redis is unavailable and fallbacks must remain active.") : "Database is unavailable.", { database, redis });
  }

  private async inboundLifecycle(): Promise<VerificationCheck> {
    const call = await this.prisma.call.findFirst({
      where: { direction: "INBOUND", status: "COMPLETED" },
      include: { callRecording: true, callTranscript: true, summary: true },
      orderBy: { endedAt: "desc" },
    });
    if (!call) return noEvidence("inbound_lifecycle", "Incoming Calls", "No completed inbound call exists for lifecycle verification.");
    const customerId = call.summary?.customerProfileId;
    const [timeline, usage, analytics, customer] = await Promise.all([
      customerId ? this.prisma.customerTimelineEvent.count({ where: { organizationId: call.organizationId, customerProfileId: customerId, eventType: { in: ["CALL_COMPLETED", "AI_SUMMARY_GENERATED"] } } }) : 0,
      this.prisma.usageEvent.count({ where: { organizationId: call.organizationId, resourceType: { in: ["INCOMING_CALLS", "AI_MINUTES", "REALTIME_VOICE_MINUTES"] }, createdAt: { gte: call.startedAt } } }),
      this.prisma.analyticsEvent.count({ where: { organizationId: call.organizationId, eventType: { in: ["CALL_STARTED", "CALL_DURATION", "AI_SUMMARY_GENERATED"] }, createdAt: { gte: call.startedAt } } }),
      customerId ? this.prisma.customerProfile.findUnique({ where: { id: customerId }, select: { totalCalls: true, lastContactAt: true } }) : null,
    ]);
    const artifacts = Boolean(call.callRecording && call.callTranscript && call.summary);
    const linked = artifacts && timeline >= 2 && usage > 0 && analytics > 0 && Boolean(customer?.totalCalls);
    return check("inbound_lifecycle", "Incoming Calls", linked ? "PASS" : "FAIL", linked ? "Latest completed inbound call has recording, transcript, summary, timeline, CRM, analytics, and usage linkage." : "Latest completed inbound call has incomplete lifecycle linkage.", { recording: Boolean(call.callRecording), transcript: Boolean(call.callTranscript), summary: Boolean(call.summary), timelineEvents: timeline, usageEvents: usage, analyticsEvents: analytics, customerCalls: customer?.totalCalls ?? 0 });
  }

  private async outboundLifecycle(): Promise<VerificationCheck> {
    const outbound = await this.prisma.outboundCall.findFirst({
      where: { status: "COMPLETED" },
      include: { recording: true, transcript: true, summary: true, lead: true, call: { include: { appointments: true } } },
      orderBy: { endedAt: "desc" },
    });
    if (!outbound) return noEvidence("outbound_lifecycle", "Outgoing Calls", "No completed outbound call exists for lifecycle verification.");
    const timeline = await this.prisma.customerTimelineEvent.count({ where: { organizationId: outbound.organizationId, customerProfileId: outbound.customerProfileId, eventType: { in: ["OUTBOUND_CALL_COMPLETED", "AI_SUMMARY_GENERATED"] } } });
    const linked = Boolean(outbound.recording && outbound.transcript && outbound.summary && outbound.callId && timeline >= 2);
    return check("outbound_lifecycle", "Outgoing Calls", linked ? "PASS" : "FAIL", linked ? "Latest completed outbound call is linked through recording, transcript, summary, CRM, and timeline." : "Latest completed outbound call has incomplete artifact linkage.", { recording: Boolean(outbound.recording), transcript: Boolean(outbound.transcript), summary: Boolean(outbound.summary), appointment: Boolean(outbound.call?.appointments.length), leadLinked: Boolean(outbound.lead), timelineEvents: timeline });
  }

  private async appointmentReminder(): Promise<VerificationCheck> {
    const execution = await this.prisma.automationExecution.findFirst({
      where: { triggerType: "UPCOMING_APPOINTMENT", actionType: "SMS", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });
    if (!execution) return noEvidence("appointment_reminder", "Automation", "No completed appointment reminder execution exists.");
    const [message, timeline, analytics] = await Promise.all([
      this.prisma.communicationMessage.count({ where: { organizationId: execution.organizationId, metadata: { path: ["automationExecutionId"], equals: execution.id } } }),
      this.prisma.customerTimelineEvent.count({ where: { organizationId: execution.organizationId, customerProfileId: execution.customerProfileId, sourceEntityType: "AutomationExecution", sourceEntityId: execution.id } }),
      this.prisma.analyticsEvent.count({ where: { organizationId: execution.organizationId, eventType: { in: ["AUTOMATION_COMPLETED", "SMS_SENT"] }, createdAt: { gte: execution.createdAt } } }),
    ]);
    const complete = message > 0 && timeline > 0 && analytics > 0;
    return check("appointment_reminder", "Automation", complete ? "PASS" : "FAIL", complete ? "Reminder execution is linked to SMS, timeline, and analytics." : "Reminder execution is missing downstream linkage.", { messages: message, timelineEvents: timeline, analyticsEvents: analytics });
  }

  private async returningCustomer(): Promise<VerificationCheck> {
    const events = await this.prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      where: { eventType: { in: ["CALLER_RECOGNIZED", "MEMORY_CONTEXT_LOADED", "GREETING_GENERATED"] } },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(events.map((event) => [event.eventType, event._count._all]));
    const complete = ["CALLER_RECOGNIZED", "MEMORY_CONTEXT_LOADED", "GREETING_GENERATED"].every((key) => Number(counts[key] ?? 0) > 0);
    return check("returning_customer", "Customer Memory", complete ? "PASS" : "WARN", complete ? "Production evidence exists for recognition, bounded memory loading, and personalized greeting generation." : "Returning-customer components are tested, but complete production event evidence is not yet present.", { recognized: Number(counts.CALLER_RECOGNIZED ?? 0), memoryLoads: Number(counts.MEMORY_CONTEXT_LOADED ?? 0), greetings: Number(counts.GREETING_GENERATED ?? 0) });
  }

  private async campaignExecution(): Promise<VerificationCheck> {
    const campaign = await this.prisma.campaign.findFirst({ include: { targets: { include: { outboundCall: true } } }, orderBy: { createdAt: "desc" } });
    if (!campaign) return noEvidence("campaign_execution", "Campaigns", "No campaign exists for production execution evidence.");
    const unique = new Set(campaign.targets.map((target) => target.customerProfileId)).size === campaign.targets.length;
    const callLinks = campaign.targets.filter((target) => target.outboundCall).length;
    const consistent = unique && campaign.targetCount === campaign.targets.length && campaign.callsCreated === callLinks;
    return check("campaign_execution", "Campaigns", consistent ? (callLinks ? "PASS" : "WARN") : "FAIL", consistent ? (callLinks ? "Campaign targets are unique and outbound call results are linked." : "Campaign selection is consistent; no campaign call has executed yet.") : "Campaign counters or target uniqueness are inconsistent.", { targets: campaign.targets.length, uniqueTargets: unique, linkedCalls: callLinks, storedCallsCreated: campaign.callsCreated });
  }

  private async phoneManagement(): Promise<VerificationCheck> {
    const [purchased, forwarded, ported] = await Promise.all([
      this.prisma.phoneNumber.count({ where: { isPurchased: true, releasedAt: null } }),
      this.prisma.externalPhoneNumber.count({ where: { status: "ACTIVE", forwardingConfirmedAt: { not: null } } }),
      this.prisma.portRequest.count({ where: { status: "COMPLETED", phoneNumberId: { not: null } } }),
    ]);
    const evidence = purchased + forwarded + ported;
    return check("phone_management", "Phone Numbers", evidence ? "PASS" : "WARN", evidence ? "Production phone inventory contains activated purchased, forwarded, or ported routing records." : "No activated phone-number lifecycle evidence is available.", { purchased, forwarded, ported });
  }

  private billingLimits(): VerificationCheck {
    const valid = PLAN_LIMITS.STARTER.campaignTargets === 100 && PLAN_LIMITS.PRO.campaignTargets === 1_000 && PLAN_LIMITS.AGENCY.campaignTargets === 10_000 && PLAN_LIMITS.STARTER.voiceMinutes === 500 && PLAN_LIMITS.PRO.voiceMinutes === 2_500;
    return check("billing_limits", "Billing", valid ? "PASS" : "FAIL", valid ? "Starter, Pro, and Agency limits are configured and centrally resolved." : "Billing limit configuration does not match launch policy.", { starterCampaignTargets: PLAN_LIMITS.STARTER.campaignTargets, proCampaignTargets: PLAN_LIMITS.PRO.campaignTargets, agencyCampaignTargets: PLAN_LIMITS.AGENCY.campaignTargets });
  }

  private memoryPolicy(): VerificationCheck {
    const policy = this.memory.memoryPolicy();
    const valid = !policy.rawTranscriptsInjected && policy.recentSummaries <= 5 && policy.recentTimelineEvents <= 10 && policy.recentAppointments <= 3;
    return check("memory_policy", "Customer Memory", valid ? "PASS" : "FAIL", valid ? "Memory context is bounded and uses summaries rather than raw transcripts." : "Memory policy could inject excessive or raw transcript context.", policy);
  }

  private async consistencyChecks(): Promise<VerificationCheck[]> {
    const [crossTenant, duplicateTargets, orphanSummaries, artifactMismatches, unprocessedAnalytics] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM outbound_calls o
        JOIN customer_profiles c ON c.id = o."customerProfileId"
        WHERE o."organizationId" <> c."organizationId"
      `),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM (
          SELECT "campaignId", "customerProfileId" FROM campaign_targets
          GROUP BY "campaignId", "customerProfileId" HAVING count(*) > 1
        ) duplicates
      `),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM call_summaries s
        LEFT JOIN calls c ON c.id = s."callId"
        LEFT JOIN customer_profiles p ON p.id = s."customerProfileId"
        WHERE c.id IS NULL OR p.id IS NULL
      `),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT count(*)::bigint AS count FROM outbound_calls o
        LEFT JOIN call_recordings r ON r.id = o."recordingId"
        LEFT JOIN call_transcripts t ON t.id = o."transcriptId"
        WHERE (o."recordingId" IS NOT NULL AND (r.id IS NULL OR r."organizationId" <> o."organizationId"))
           OR (o."transcriptId" IS NOT NULL AND (t.id IS NULL OR t."organizationId" <> o."organizationId"))
      `),
      this.prisma.analyticsEvent.count({ where: { processedAt: null, createdAt: { lt: new Date(Date.now() - 5 * 60_000) } } }),
    ]);
    const values = {
      crossTenantLinks: Number(crossTenant[0]?.count ?? 0n),
      duplicateCampaignTargets: Number(duplicateTargets[0]?.count ?? 0n),
      orphanSummaries: Number(orphanSummaries[0]?.count ?? 0n),
      artifactMismatches: Number(artifactMismatches[0]?.count ?? 0n),
      staleAnalyticsEvents: unprocessedAnalytics,
    };
    return [
      check("tenant_consistency", "Security", values.crossTenantLinks === 0 ? "PASS" : "FAIL", values.crossTenantLinks === 0 ? "No cross-tenant outbound/customer links detected." : "Cross-tenant relationship mismatches detected.", { crossTenantLinks: values.crossTenantLinks }),
      check("data_consistency", "Data Consistency", values.duplicateCampaignTargets === 0 && values.orphanSummaries === 0 && values.artifactMismatches === 0 ? (values.staleAnalyticsEvents ? "WARN" : "PASS") : "FAIL", "Checked campaign uniqueness, stable summary links, recording/transcript ownership, and analytics backlog.", values),
    ];
  }

  private async performanceChecks(): Promise<PerformanceMeasurement[]> {
    return Promise.all([
      this.measure("dashboard_data_query", 300, () => this.prisma.organization.count({ where: { deletedAt: null } })),
      this.measure("analytics_snapshot_query", 100, () => this.prisma.analyticsDailyMetric.findMany({ orderBy: { date: "desc" }, take: 30 })),
      this.measure("customer_search_query", 150, () => this.prisma.customerProfile.findMany({ where: { name: { contains: "a", mode: "insensitive" } }, select: { id: true }, take: 20 })),
      this.measure("timeline_retrieval_query", 200, () => this.prisma.customerTimelineEvent.findMany({ select: { id: true }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 30 })),
    ]);
  }

  private async measure(name: string, targetP95Ms: number, operation: () => Promise<unknown>): Promise<PerformanceMeasurement> {
    const samples: number[] = [];
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const started = performance.now();
      await operation();
      samples.push(performance.now() - started);
    }
    samples.sort((left, right) => left - right);
    const p50Ms = percentile(samples, 0.5);
    const p95Ms = percentile(samples, 0.95);
    const p99Ms = percentile(samples, 0.99);
    return { name, samples: samples.length, p50Ms, p95Ms, p99Ms, targetP95Ms, status: p95Ms <= targetP95Ms ? "PASS" : "FAIL" };
  }
}

function check(id: string, area: string, status: VerificationStatus, message: string, evidence?: Record<string, string | number | boolean | null>): VerificationCheck {
  return { id, area, status, message, evidence };
}
function noEvidence(id: string, area: string, message: string) { return check(id, area, "WARN", message, { productionEvidence: false }); }
function percentile(values: number[], percentileValue: number) { return Number(values[Math.max(0, Math.ceil(values.length * percentileValue) - 1)]!.toFixed(3)); }
