import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CampaignStatus, Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { FeatureGateService } from "../billing/feature-gate.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { OutboundCallService } from "../outbound-call/outbound-call.service";
import type { TenantContext } from "../tenant/tenant.service";
import { UsageService } from "../usage/usage.service";
import { CampaignTargetService } from "./campaign-target.service";
import type { CreateCampaignDto } from "./dto/campaign.dto";

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: CampaignTargetService,
    private readonly gates: FeatureGateService,
    private readonly outboundCalls: OutboundCallService,
    private readonly usage: UsageService,
    @Optional() private readonly timeline?: CustomerTimelineService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async create(context: TenantContext, input: CreateCampaignDto) {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: input.assignedAgentId,
        organizationId: context.organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!agent) throw new NotFoundException("Active AI agent not found.");
    if (input.scheduleType === "SCHEDULED" && !input.scheduledAt) {
      throw new BadRequestException("A scheduled campaign requires scheduledAt.");
    }
    if (input.scheduleType === "RECURRING" && !input.recurrence) {
      throw new BadRequestException("Recurring campaigns require recurrence configuration.");
    }
    const selected = await this.targets.resolve({
      organizationId: context.organizationId,
      customerProfileIds: input.customerProfileIds,
      targeting: input.targeting,
    });
    await this.gates.assertCampaignTargetCapacity(context.organizationId, selected.length);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          organizationId: context.organizationId,
          name: input.name.trim(),
          description: input.description?.trim(),
          campaignType: input.campaignType,
          assignedAgentId: input.assignedAgentId,
          scheduleType: input.scheduleType,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          recurrence: input.recurrence as Prisma.InputJsonValue | undefined,
          targetingFilters: (input.targeting ?? {}) as Prisma.InputJsonValue,
          maxAttempts: input.maxAttempts ?? 1,
          targetCount: selected.length,
          targets: { createMany: { data: selected, skipDuplicates: true } },
        },
        include: campaignInclude,
      });
      await tx.auditEvent.create({
        data: {
          organizationId: context.organizationId,
          action: "campaign.created",
          entityType: "Campaign",
          entityId: created.id,
          metadata: { type: created.campaignType, targets: selected.length },
        },
      });
      return created;
    });
    await this.usage.increment({
      organizationId: context.organizationId,
      resourceType: "CAMPAIGN_TARGETS",
      quantity: selected.length,
      idempotencyKey: `campaign:targets:${campaign.id}`,
    });
    return serializeCampaign(campaign);
  }

  async list(context: TenantContext, input: { status?: string; limit?: number } = {}) {
    const status = validStatus(input.status);
    const rows = await this.prisma.campaign.findMany({
      where: { organizationId: context.organizationId, ...(status ? { status } : {}) },
      include: campaignSummaryInclude,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
    return rows.map((row) => serializeCampaign(row));
  }

  async get(context: TenantContext, id: string) {
    const campaign = await this.findOwned(context.organizationId, id);
    return serializeCampaign(campaign, true);
  }

  async customerHistory(context: TenantContext, customerProfileId: string) {
    const customer = await this.prisma.customerProfile.findFirst({
      where: { id: customerProfileId, organizationId: context.organizationId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    return this.prisma.campaignTarget.findMany({
      where: { customerProfileId, campaign: { organizationId: context.organizationId } },
      include: {
        campaign: { select: { id: true, name: true, campaignType: true, status: true } },
        outboundCall: { select: { id: true, status: true, qualified: true, appointmentBooked: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async start(context: TenantContext, id: string) {
    const campaign = await this.findOwned(context.organizationId, id);
    if (!["DRAFT", "SCHEDULED", "PAUSED"].includes(campaign.status)) {
      throw new BadRequestException(`A ${campaign.status.toLowerCase()} campaign cannot be started.`);
    }
    if (campaign.scheduleType === "RECURRING") {
      throw new BadRequestException("Recurring execution is schema-ready but not enabled yet.");
    }
    const scheduled = campaign.scheduleType === "SCHEDULED" && campaign.scheduledAt && campaign.scheduledAt > new Date();
    const status = scheduled ? "SCHEDULED" : "RUNNING";
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status, ...(status === "RUNNING" && !campaign.startedAt ? { startedAt: new Date() } : {}) },
      include: campaignInclude,
    });
    await this.audit(context.organizationId, status === "RUNNING" ? "campaign.started" : "campaign.scheduled", id);
    return serializeCampaign(updated);
  }

  async pause(context: Pick<TenantContext, "organizationId">, id: string) {
    const campaign = await this.findOwned(context.organizationId, id);
    if (!["RUNNING", "SCHEDULED"].includes(campaign.status)) {
      throw new BadRequestException("Only running or scheduled campaigns can be paused.");
    }
    const updated = await this.prisma.campaign.update({ where: { id }, data: { status: "PAUSED" }, include: campaignSummaryInclude });
    await this.audit(context.organizationId, "campaign.paused", id);
    return serializeCampaign(updated);
  }

  async resume(context: TenantContext, id: string) {
    const campaign = await this.findOwned(context.organizationId, id);
    if (campaign.status !== "PAUSED") throw new BadRequestException("Campaign is not paused.");
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: "RUNNING", startedAt: campaign.startedAt ?? new Date() },
      include: campaignSummaryInclude,
    });
    await this.audit(context.organizationId, "campaign.resumed", id);
    return serializeCampaign(updated);
  }

  async cancel(context: Pick<TenantContext, "organizationId">, id: string) {
    const campaign = await this.findOwned(context.organizationId, id);
    if (["COMPLETED", "CANCELLED"].includes(campaign.status)) {
      return serializeCampaign(campaign);
    }
    const active = campaign.targets.find(
      (target) => target.outboundCall && !["COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "VOICEMAIL", "CANCELLED"].includes(target.outboundCall.status),
    );
    if (active?.outboundCall) {
      await this.outboundCalls.cancel(context, active.outboundCall.id).catch(() => undefined);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.campaignTarget.updateMany({
        where: { campaignId: id, status: { in: ["PENDING", "QUEUED"] } },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      return tx.campaign.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: campaignInclude,
      });
    });
    await this.audit(context.organizationId, "campaign.cancelled", id);
    return serializeCampaign(updated);
  }

  async dispatchNext(organizationId: string, campaignId: string) {
    await this.reconcileCampaign(organizationId, campaignId);
    const campaign = await this.findOwned(organizationId, campaignId);
    if (campaign.status === "SCHEDULED" && campaign.scheduledAt && campaign.scheduledAt <= new Date()) {
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "RUNNING", startedAt: campaign.startedAt ?? new Date() },
      });
      campaign.status = "RUNNING";
      await this.audit(organizationId, "campaign.started", campaign.id);
    }
    if (campaign.status !== "RUNNING") return { dispatched: false, reason: campaign.status };
    if (!(await this.gates.canReceiveCalls(organizationId))) {
      await this.prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
      await this.audit(organizationId, "campaign.paused_usage_limit", campaign.id);
      return { dispatched: false, reason: "VOICE_LIMIT" };
    }
    const globalActiveCall = await this.prisma.campaignTarget.findFirst({
      where: {
        status: "CALL_CREATED",
        outboundCall: {
          status: { notIn: ["COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "VOICEMAIL", "CANCELLED"] },
        },
      },
      select: { id: true },
    });
    if (globalActiveCall) return { dispatched: false, reason: "GLOBAL_ACTIVE_CALL" };
    const active = campaign.targets.some(
      (target) => target.outboundCall && !["COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "VOICEMAIL", "CANCELLED"].includes(target.outboundCall.status),
    );
    if (active) return { dispatched: false, reason: "ACTIVE_CALL" };

    const target = campaign.targets.find((item) => item.status === "PENDING");
    if (!target) {
      await this.completeIfFinished(organizationId, campaign.id);
      return { dispatched: false, reason: "NO_PENDING_TARGETS" };
    }
    const claimed = await this.prisma.campaignTarget.updateMany({
      where: { id: target.id, status: "PENDING", campaign: { status: "RUNNING" } },
      data: { status: "QUEUED", attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
    });
    if (!claimed.count) return { dispatched: false, reason: "CLAIMED" };
    try {
      const outbound = await this.outboundCalls.create(
        { organizationId },
        {
          customerProfileId: target.customerProfileId,
          agentId: campaign.assignedAgentId,
          reasonType: "SYSTEM_TRIGGER",
          reasonDescription: `${formatType(campaign.campaignType)} campaign: ${campaign.name}`,
          source: "CAMPAIGN",
          campaignTargetId: target.id,
        },
      );
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: { status: "CALL_CREATED", outboundCallId: outbound.id, failureReason: null },
      });
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { callsCreated: { increment: 1 } },
      });
      await Promise.all([
        this.timeline?.recordEvent({
          organizationId,
          customerProfileId: target.customerProfileId,
          eventType: "CAMPAIGN_CALL_CREATED",
          sourceEntityType: "Campaign",
          sourceEntityId: campaign.id,
          idempotencyKey: `campaign:call:${target.id}`,
          description: campaign.name,
          metadata: { campaignId: campaign.id, outboundCallId: outbound.id },
        }),
        this.usage.increment({ organizationId, resourceType: "CAMPAIGN_CALLS", idempotencyKey: `campaign:call:${target.id}` }),
        this.analytics?.record({
          organizationId,
          eventType: "CAMPAIGN_CALL_CREATED",
          idempotencyKey: `analytics:campaign-call:${target.id}`,
          agentId: campaign.assignedAgentId,
          metadata: { campaignId: campaign.id, targetId: target.id },
        }),
      ]);
      return { dispatched: true, targetId: target.id, outboundCallId: outbound.id };
    } catch (error) {
      const attemptCount = target.attemptCount + 1;
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: {
          status: attemptCount >= campaign.maxAttempts ? "FAILED" : "PENDING",
          failureReason: safeError(error),
          ...(attemptCount >= campaign.maxAttempts ? { completedAt: new Date() } : {}),
        },
      });
      return { dispatched: false, reason: "CALL_FAILED" };
    }
  }

  async reconcileCampaign(organizationId: string, campaignId: string) {
    const targets = await this.prisma.campaignTarget.findMany({
      where: { campaignId, campaign: { organizationId }, status: "CALL_CREATED", outboundCallId: { not: null } },
      include: { outboundCall: true },
    });
    for (const target of targets) {
      const call = target.outboundCall;
      if (!call || !["COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "VOICEMAIL", "CANCELLED"].includes(call.status)) continue;
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: {
          status: call.status === "COMPLETED" ? "COMPLETED" : "FAILED",
          completedAt: new Date(),
          failureReason: call.status === "COMPLETED" ? null : call.status,
        },
      });
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          callsCompleted: { increment: 1 },
          ...(call.status === "COMPLETED" ? { connectedCalls: { increment: 1 } } : {}),
          ...(call.qualified ? { qualifiedLeads: { increment: 1 } } : {}),
          ...(call.appointmentBooked ? { appointmentsBooked: { increment: 1 } } : {}),
        },
      });
      if (call.durationSeconds) {
        await this.usage.increment({
          organizationId,
          resourceType: "CAMPAIGN_MINUTES",
          quantity: Math.ceil(call.durationSeconds / 60),
          idempotencyKey: `campaign:minutes:${target.id}`,
        });
      }
    }
    await this.completeIfFinished(organizationId, campaignId);
  }

  async dueCampaigns() {
    return this.prisma.campaign.findMany({
      where: {
        OR: [
          { status: "RUNNING" },
          { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
        ],
      },
      select: { id: true, organizationId: true },
      take: 100,
    });
  }

  async adminList(limit = 100) {
    const rows = await this.prisma.campaign.findMany({
      include: { ...campaignSummaryInclude, organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });
    return rows.map((row) => ({ ...serializeCampaign(row), organization: row.organization }));
  }

  async adminPause(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, select: { organizationId: true } });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    return this.pause({ organizationId: campaign.organizationId }, id);
  }

  async adminCancel(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, select: { organizationId: true } });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    return this.cancel({ organizationId: campaign.organizationId }, id);
  }

  private async completeIfFinished(organizationId: string, campaignId: string) {
    const remaining = await this.prisma.campaignTarget.count({
      where: { campaignId, status: { in: ["PENDING", "QUEUED", "CALL_CREATED"] } },
    });
    if (remaining) return;
    const completed = await this.prisma.campaign.updateMany({
      where: { id: campaignId, organizationId, status: "RUNNING" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (completed.count) await this.audit(organizationId, "campaign.completed", campaignId);
  }

  private async findOwned(organizationId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: campaignInclude,
    });
    if (!campaign) throw new NotFoundException("Campaign not found.");
    return campaign;
  }

  private audit(organizationId: string, action: string, entityId: string) {
    return this.prisma.auditEvent.create({
      data: { organizationId, action, entityType: "Campaign", entityId },
    });
  }
}

const campaignInclude = {
  assignedAgent: { select: { id: true, name: true, status: true } },
  targets: {
    include: {
      customerProfile: { select: { id: true, name: true, phone: true, leadStatus: true } },
      lead: { select: { id: true, status: true } },
      outboundCall: { select: { id: true, status: true, durationSeconds: true, qualified: true, appointmentBooked: true, summaryId: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.CampaignInclude;

const campaignSummaryInclude = {
  assignedAgent: { select: { id: true, name: true, status: true } },
} satisfies Prisma.CampaignInclude;

type LoadedCampaign = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;
type CampaignSummary = Prisma.CampaignGetPayload<{ include: typeof campaignSummaryInclude }>;

function serializeCampaign(campaign: CampaignSummary | LoadedCampaign, includeTargets = false) {
  return {
    id: campaign.id,
    organizationId: campaign.organizationId,
    name: campaign.name,
    description: campaign.description,
    campaignType: campaign.campaignType,
    status: campaign.status,
    scheduleType: campaign.scheduleType,
    scheduledAt: campaign.scheduledAt,
    maxAttempts: campaign.maxAttempts,
    assignedAgent: campaign.assignedAgent,
    metrics: {
      targets: campaign.targetCount,
      callsCreated: campaign.callsCreated,
      callsCompleted: campaign.callsCompleted,
      connectionRate: campaign.callsCreated ? (campaign.connectedCalls / campaign.callsCreated) * 100 : 0,
      qualificationRate: campaign.connectedCalls ? (campaign.qualifiedLeads / campaign.connectedCalls) * 100 : 0,
      appointmentRate: campaign.connectedCalls ? (campaign.appointmentsBooked / campaign.connectedCalls) * 100 : 0,
      conversionRate: campaign.targetCount ? (campaign.appointmentsBooked / campaign.targetCount) * 100 : 0,
    },
    ...(includeTargets && "targets" in campaign ? { targets: campaign.targets } : {}),
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

function validStatus(value?: string): CampaignStatus | undefined {
  return value && ["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "CANCELLED"].includes(value)
    ? (value as CampaignStatus)
    : undefined;
}

function formatType(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Outbound call creation failed.").slice(0, 1000);
}
