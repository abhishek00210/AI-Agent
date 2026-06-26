import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type {
  OutboundCallReasonType,
  OutboundCallStatus,
  Prisma,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { CustomerResolverService } from "../customer/customer-resolver.service";
import type { TenantContext } from "../tenant/tenant.service";
import { UsageService } from "../usage/usage.service";
import { OutboundCallProvider } from "./outbound-call.provider";
import { isMachineAnswer, isTerminalOutboundStatus, outboundReasonType } from "./outbound-call.types";

type AutomationExecutionForOutbound = Prisma.AutomationExecutionGetPayload<{
  include: { workflow: true; customerProfile: true };
}>;

@Injectable()
export class OutboundCallService {
  private readonly logger = new Logger(OutboundCallService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: OutboundCallProvider,
    private readonly customers: CustomerResolverService,
    @Optional() private readonly timeline?: CustomerTimelineService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async create(
    context: Pick<TenantContext, "organizationId">,
    input: {
      customerProfileId: string;
      agentId: string;
      phoneNumberId?: string;
      reasonType?: OutboundCallReasonType;
      reasonDescription: string;
      source?: "MANUAL" | "CAMPAIGN";
      campaignTargetId?: string;
    },
  ) {
    const [customer, agent] = await Promise.all([
      this.prisma.customerProfile.findFirst({
        where: { id: input.customerProfileId, organizationId: context.organizationId },
        select: { id: true, phone: true },
      }),
      this.prisma.agent.findFirst({
        where: {
          id: input.agentId,
          organizationId: context.organizationId,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    if (!customer) throw new NotFoundException("Customer profile not found.");
    if (!customer.phone) throw new BadRequestException("Customer does not have a callable phone number.");
    if (!agent) throw new NotFoundException("Active AI agent not found.");

    const phoneNumber = input.phoneNumberId
      ? await this.prisma.phoneNumber.findFirst({
          where: {
            id: input.phoneNumberId,
            organizationId: context.organizationId,
            status: "ACTIVE",
            deletedAt: null,
            OR: [{ agentId: input.agentId }, { agentId: null }],
          },
          select: { id: true, phoneNumber: true },
        })
      : await this.selectOutboundNumber(context.organizationId, input.agentId);
    if (!phoneNumber) {
      throw new BadRequestException("No active phone number is available for this agent.");
    }

    const reasonType = input.reasonType ?? "MANUAL_CALL";
    const source = input.source ?? "MANUAL";
    const attemptNumber = await this.nextAttemptNumber(context.organizationId, null, customer.id);
    const outbound = await this.prisma.outboundCall.create({
      data: {
        organizationId: context.organizationId,
        customerProfileId: customer.id,
        agentId: agent.id,
        phoneNumberId: phoneNumber.id,
        reasonType,
        reasonDescription: input.reasonDescription,
        attemptNumber,
        scheduledAt: new Date(),
        metadata: {
          source,
          voicemailMode: "HANG_UP",
          ...(input.campaignTargetId ? { campaignTargetId: input.campaignTargetId } : {}),
        },
      },
      include: outboundInclude,
    });

    await Promise.all([
      this.timeline?.recordEvent({
        organizationId: outbound.organizationId,
        customerProfileId: outbound.customerProfileId,
        eventType: "OUTBOUND_CALL_CREATED",
        sourceEntityType: "OutboundCall",
        sourceEntityId: outbound.id,
        idempotencyKey: `outbound-call:created:${outbound.id}`,
        description: outbound.reasonDescription,
        metadata: { reasonType, attemptNumber, source },
        occurredAt: outbound.createdAt,
      }),
      this.audit(outbound.organizationId, "outbound_call.created", outbound.id, {
        reasonType,
        attemptNumber,
        source,
      }),
    ]);

    try {
      await this.prisma.outboundCall.update({
        where: { id: outbound.id },
        data: { status: "DIALING" },
      });
      const started = await this.provider.startCall({
        to: customer.phone,
        from: phoneNumber.phoneNumber,
      });
      const call = await this.prisma.call.upsert({
        where: { twilioCallSid: started.providerCallSid },
        create: {
          organizationId: outbound.organizationId,
          agentId: agent.id,
          phoneNumberId: phoneNumber.id,
          twilioCallSid: started.providerCallSid,
          callerNumber: customer.phone,
          calledNumber: phoneNumber.phoneNumber,
          direction: "OUTBOUND",
          status: "RINGING",
          source: "VOICE",
          metadata: {
            outboundCallId: outbound.id,
            reasonType,
            reasonDescription: outbound.reasonDescription,
            source,
            campaignTargetId: input.campaignTargetId ?? null,
            twilioInitialStatus: started.status,
          },
        },
        update: {
          metadata: {
            outboundCallId: outbound.id,
            reasonType,
            reasonDescription: outbound.reasonDescription,
            source,
            campaignTargetId: input.campaignTargetId ?? null,
            twilioInitialStatus: started.status,
          },
        },
      });
      const updated = await this.prisma.outboundCall.update({
        where: { id: outbound.id },
        data: {
          callId: call.id,
          providerCallSid: started.providerCallSid,
          status: mapProviderStatus(started.status),
        },
        include: outboundInclude,
      });
      await Promise.all([
        this.usage?.increment({
          organizationId: outbound.organizationId,
          resourceType: "OUTBOUND_CALLS",
          idempotencyKey: `outbound:call:${outbound.id}`,
        }),
        this.analytics?.record({
          organizationId: outbound.organizationId,
          eventType: "OUTBOUND_CALL_STARTED",
          idempotencyKey: `analytics:outbound-started:${outbound.id}`,
          agentId: agent.id,
          metadata: { reasonType, source },
        }),
      ]);
      return toOutboundCallResponse(updated);
    } catch (error) {
      await this.markFailed(outbound.id, outbound.organizationId, readError(error));
      throw error;
    }
  }

  async startFromAutomation(execution: AutomationExecutionForOutbound) {
    if (execution.actionType !== "CALL") {
      throw new BadRequestException("Automation execution is not a CALL action.");
    }
    if (!execution.customerProfile.phone) {
      throw new BadRequestException("Customer does not have a callable phone number.");
    }

    const lead = await this.findLead(execution);
    const agentId =
      execution.workflow.assignedAgentId ??
      lead?.agentId ??
      jsonString(execution.metadata, "triggerMetadata", "agentId") ??
      (await this.defaultAgent(execution.organizationId))?.id;
    if (!agentId) throw new BadRequestException("No active AI agent is available for outbound call.");

    const phoneNumber = await this.selectOutboundNumber(execution.organizationId, agentId);
    if (!phoneNumber) throw new BadRequestException("No active phone number is available for outbound call.");

    const customer = await this.customers.resolveCustomer({
      organizationId: execution.organizationId,
      contactId: execution.customerProfile.contactId,
      name: execution.customerProfile.name,
      phone: execution.customerProfile.phone,
      email: execution.customerProfile.email ?? undefined,
      interaction: "CALL",
    });
    const reasonType = outboundReasonType(execution.reasonType);
    const attemptNumber = await this.nextAttemptNumber(execution.organizationId, lead?.id ?? null, customer.id);

    const outbound = await this.prisma.outboundCall.create({
      data: {
        organizationId: execution.organizationId,
        customerProfileId: customer.id,
        leadId: lead?.id ?? null,
        agentId,
        phoneNumberId: phoneNumber.id,
        automationExecutionId: execution.id,
        reasonType,
        reasonDescription: execution.reasonDescription,
        attemptNumber,
        scheduledAt: execution.scheduledFor,
        metadata: {
          automationExecutionId: execution.id,
          workflowId: execution.workflowId,
          ruleId: execution.ruleId,
          triggerType: execution.triggerType,
          source: "AUTOMATION",
          voicemailMode: "HANG_UP",
        },
      },
      include: outboundInclude,
    });

    await Promise.all([
      this.timeline?.recordEvent({
        organizationId: outbound.organizationId,
        customerProfileId: outbound.customerProfileId,
        eventType: "OUTBOUND_CALL_CREATED",
        sourceEntityType: "OutboundCall",
        sourceEntityId: outbound.id,
        idempotencyKey: `outbound-call:created:${outbound.id}`,
        description: outbound.reasonDescription,
        metadata: { reasonType, attemptNumber },
        occurredAt: outbound.createdAt,
      }),
      this.audit(outbound.organizationId, "outbound_call.created", outbound.id, {
        reasonType,
        attemptNumber,
      }),
      this.usage?.increment({
        organizationId: outbound.organizationId,
        resourceType: "QUALIFICATION_ATTEMPTS",
        idempotencyKey: `outbound:qualification:${outbound.id}`,
      }),
    ]);

    try {
      await this.prisma.outboundCall.update({
        where: { id: outbound.id },
        data: { status: "DIALING" },
      });
      const started = await this.provider.startCall({
        to: execution.customerProfile.phone,
        from: phoneNumber.phoneNumber,
      });
      const call = await this.prisma.call.upsert({
        where: { twilioCallSid: started.providerCallSid },
        create: {
          organizationId: outbound.organizationId,
          agentId,
          phoneNumberId: phoneNumber.id,
          twilioCallSid: started.providerCallSid,
          callerNumber: execution.customerProfile.phone,
          calledNumber: phoneNumber.phoneNumber,
          direction: "OUTBOUND",
          status: "RINGING",
          source: "VOICE",
          metadata: {
            outboundCallId: outbound.id,
            leadId: lead?.id ?? null,
            reasonType,
            reasonDescription: outbound.reasonDescription,
            twilioInitialStatus: started.status,
          },
        },
        update: {
          metadata: {
            outboundCallId: outbound.id,
            leadId: lead?.id ?? null,
            reasonType,
            reasonDescription: outbound.reasonDescription,
            twilioInitialStatus: started.status,
          },
        },
      });
      const updated = await this.prisma.outboundCall.update({
        where: { id: outbound.id },
        data: {
          callId: call.id,
          providerCallSid: started.providerCallSid,
          status: mapProviderStatus(started.status),
        },
        include: outboundInclude,
      });
      await Promise.all([
        this.usage?.increment({
          organizationId: outbound.organizationId,
          resourceType: "OUTBOUND_CALLS",
          idempotencyKey: `outbound:call:${outbound.id}`,
        }),
        this.analytics?.record({
          organizationId: outbound.organizationId,
          eventType: "OUTBOUND_CALL_STARTED",
          idempotencyKey: `analytics:outbound-started:${outbound.id}`,
          agentId,
          metadata: { reasonType, leadId: lead?.id ?? null },
        }),
      ]);
      return updated;
    } catch (error) {
      const reason = readError(error);
      await this.markFailed(outbound.id, outbound.organizationId, reason);
      throw error;
    }
  }

  async handleStatusCallback(input: {
    providerCallSid: string;
    callStatus?: string;
    answeredBy?: string | null;
    durationSeconds?: number | null;
  }) {
    const outbound = await this.prisma.outboundCall.findFirst({
      where: { providerCallSid: input.providerCallSid },
      include: outboundInclude,
    });
    if (!outbound) throw new NotFoundException("Outbound call not found.");

    const status = isMachineAnswer(input.answeredBy)
      ? "VOICEMAIL"
      : mapProviderStatus(input.callStatus);
    const now = new Date();
    const durationSeconds = input.durationSeconds ?? outbound.durationSeconds ?? null;
    const updated = await this.prisma.outboundCall.update({
      where: { id: outbound.id },
      data: {
        status,
        ...(status === "IN_PROGRESS" && !outbound.startedAt ? { startedAt: now } : {}),
        ...(isTerminalOutboundStatus(status) ? { endedAt: now, durationSeconds } : {}),
      },
      include: outboundInclude,
    });
    await this.updateCallFromOutboundStatus(updated, status, durationSeconds);
    if (status === "IN_PROGRESS" && !outbound.startedAt) await this.recordStarted(updated);
    if (status === "VOICEMAIL") await this.handleVoicemail(updated);
    if (isTerminalOutboundStatus(status)) await this.recordTerminal(updated);
    return updated;
  }

  async list(context: TenantContext, input: { status?: OutboundCallStatus; limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const data = await this.prisma.outboundCall.findMany({
      where: { organizationId: context.organizationId, ...(input.status ? { status: input.status } : {}) },
      include: outboundInclude,
      orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    return data.map(toOutboundCallResponse);
  }

  async get(context: TenantContext, id: string) {
    const outbound = await this.prisma.outboundCall.findFirst({
      where: { id, organizationId: context.organizationId },
      include: outboundInclude,
    });
    if (!outbound) throw new NotFoundException("Outbound call not found.");
    return toOutboundCallResponse(outbound);
  }

  async cancel(context: Pick<TenantContext, "organizationId">, id: string) {
    const outbound = await this.prisma.outboundCall.findFirst({
      where: { id, organizationId: context.organizationId },
      include: outboundInclude,
    });
    if (!outbound) throw new NotFoundException("Outbound call not found.");
    if (outbound.status === "CANCELLED") return toOutboundCallResponse(outbound);
    if (isTerminalOutboundStatus(outbound.status)) {
      throw new BadRequestException(`A ${outbound.status.toLowerCase()} call cannot be cancelled.`);
    }

    if (outbound.providerCallSid) await this.provider.cancelCall(outbound.providerCallSid);
    const cancelled = await this.prisma.outboundCall.update({
      where: { id: outbound.id },
      data: { status: "CANCELLED", endedAt: new Date() },
      include: outboundInclude,
    });
    await Promise.all([
      this.updateCallFromOutboundStatus(cancelled, "CANCELLED", cancelled.durationSeconds),
      this.timeline?.recordEvent({
        organizationId: cancelled.organizationId,
        customerProfileId: cancelled.customerProfileId,
        eventType: "OUTBOUND_CALL_FAILED",
        sourceEntityType: "OutboundCall",
        sourceEntityId: cancelled.id,
        idempotencyKey: `outbound-call:cancelled:${cancelled.id}`,
        description: "Outbound call cancelled.",
        metadata: { status: "CANCELLED", reasonType: cancelled.reasonType },
      }),
      this.audit(cancelled.organizationId, "outbound_call.cancelled", cancelled.id, {
        providerCallSid: cancelled.providerCallSid,
      }),
    ]);
    return toOutboundCallResponse(cancelled);
  }

  private async findLead(execution: AutomationExecutionForOutbound) {
    const sourceEntityType = jsonString(execution.metadata, "sourceEntityType");
    const sourceEntityId = jsonString(execution.metadata, "sourceEntityId");
    if (sourceEntityType === "Lead" && sourceEntityId) {
      return this.prisma.lead.findFirst({
        where: { id: sourceEntityId, organizationId: execution.organizationId, deletedAt: null },
      });
    }
    return this.prisma.lead.findFirst({
      where: {
        organizationId: execution.organizationId,
        contactId: execution.customerProfile.contactId,
        deletedAt: null,
      },
      orderBy: { lastInteractionAt: "desc" },
    });
  }

  private defaultAgent(organizationId: string) {
    return this.prisma.agent.findFirst({
      where: { organizationId, status: "ACTIVE", deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  }

  private selectOutboundNumber(organizationId: string, agentId: string) {
    return this.prisma.phoneNumber.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
        OR: [{ agentId }, { agentId: null }],
      },
      orderBy: [{ agentId: "desc" }, { createdAt: "asc" }],
      select: { id: true, phoneNumber: true },
    });
  }

  private async nextAttemptNumber(organizationId: string, leadId: string | null, customerProfileId: string) {
    const previous = await this.prisma.outboundCall.count({
      where: { organizationId, ...(leadId ? { leadId } : { customerProfileId }) },
    });
    return previous + 1;
  }

  private async recordStarted(outbound: LoadedOutboundCall) {
    await Promise.all([
      this.timeline?.recordEvent({
        organizationId: outbound.organizationId,
        customerProfileId: outbound.customerProfileId,
        eventType: "OUTBOUND_CALL_STARTED",
        sourceEntityType: "OutboundCall",
        sourceEntityId: outbound.id,
        idempotencyKey: `outbound-call:started:${outbound.id}`,
        description: outbound.reasonDescription,
        metadata: { callId: outbound.callId, reasonType: outbound.reasonType },
        occurredAt: outbound.startedAt ?? new Date(),
      }),
      this.audit(outbound.organizationId, "outbound_call.started", outbound.id, {
        callId: outbound.callId,
      }),
    ]);
  }

  private async recordTerminal(outbound: LoadedOutboundCall) {
    const qualified = await this.inferQualification(outbound);
    const appointmentBooked = await this.hasAppointment(outbound);
    const durationMinutes = outbound.durationSeconds ? Math.ceil(outbound.durationSeconds / 60) : 0;
    const leadStatus = appointmentBooked ? "BOOKED" : qualified ? "QUALIFIED" : outbound.status === "COMPLETED" ? "CONTACTED" : undefined;
    await Promise.all([
      this.prisma.outboundCall.update({
        where: { id: outbound.id },
        data: { qualified, appointmentBooked },
      }),
      outbound.leadId && leadStatus
        ? this.prisma.lead.updateMany({
            where: { id: outbound.leadId, organizationId: outbound.organizationId },
            data: {
              status: leadStatus,
              score: { increment: qualified ? 20 : 5 },
              lastInteractionAt: new Date(),
              callId: outbound.callId ?? undefined,
              agentId: outbound.agentId,
              metadata: mergeJson(outbound.lead?.metadata, {
                outboundQualification: {
                  outboundCallId: outbound.id,
                  status: outbound.status,
                  qualified,
                  appointmentBooked,
                },
              }),
            },
          })
        : undefined,
      qualified
        ? this.timeline?.recordEvent({
            organizationId: outbound.organizationId,
            customerProfileId: outbound.customerProfileId,
            eventType: "LEAD_QUALIFIED",
            sourceEntityType: "OutboundCall",
            sourceEntityId: outbound.id,
            idempotencyKey: `outbound-call:qualified:${outbound.id}`,
            description: outbound.reasonDescription,
            metadata: { leadId: outbound.leadId, callId: outbound.callId },
          })
        : undefined,
      this.timeline?.recordEvent({
        organizationId: outbound.organizationId,
        customerProfileId: outbound.customerProfileId,
        eventType:
          outbound.status === "COMPLETED" ? "OUTBOUND_CALL_COMPLETED" : "OUTBOUND_CALL_FAILED",
        sourceEntityType: "OutboundCall",
        sourceEntityId: outbound.id,
        idempotencyKey: `outbound-call:terminal:${outbound.id}:${outbound.status}`,
        description: outbound.reasonDescription,
        metadata: {
          status: outbound.status,
          reasonType: outbound.reasonType,
          durationSeconds: outbound.durationSeconds,
          appointmentBooked,
          qualified,
        },
        occurredAt: outbound.endedAt ?? new Date(),
      }),
      durationMinutes
        ? this.usage?.increment({
            organizationId: outbound.organizationId,
            resourceType: "OUTBOUND_MINUTES",
            quantity: durationMinutes,
            idempotencyKey: `outbound:minutes:${outbound.id}`,
          })
        : undefined,
      this.analytics?.record({
        organizationId: outbound.organizationId,
        eventType: "OUTBOUND_CALL_COMPLETED",
        idempotencyKey: `analytics:outbound-completed:${outbound.id}:${outbound.status}`,
        agentId: outbound.agentId,
        metadata: {
          status: outbound.status,
          reasonType: outbound.reasonType,
          qualified,
          appointmentBooked,
          durationSeconds: outbound.durationSeconds,
        },
      }),
      this.audit(outbound.organizationId, "outbound_call.completed", outbound.id, {
        status: outbound.status,
        qualified,
        appointmentBooked,
      }),
    ]);
  }

  private async handleVoicemail(outbound: LoadedOutboundCall) {
    const voicemailMode = jsonString(outbound.metadata, "voicemailMode") === "LEAVE_MESSAGE" ? "LEAVE_MESSAGE" : "HANG_UP";
    if (!outbound.providerCallSid) return;
    await this.provider.leaveVoicemailOrHangUp({
      providerCallSid: outbound.providerCallSid,
      mode: voicemailMode,
      message: "Hi, this is a quick follow-up. Please call us back when you have a moment. Thank you.",
    });
  }

  private async updateCallFromOutboundStatus(
    outbound: LoadedOutboundCall,
    status: OutboundCallStatus,
    durationSeconds: number | null,
  ) {
    if (!outbound.callId) return;
    const callStatus = status === "IN_PROGRESS" ? "CONNECTED" : status === "COMPLETED" ? "COMPLETED" : ["BUSY", "NO_ANSWER", "VOICEMAIL"].includes(status) ? "MISSED" : ["FAILED", "CANCELLED"].includes(status) ? "FAILED" : "RINGING";
    await this.prisma.call.updateMany({
      where: { id: outbound.callId, organizationId: outbound.organizationId },
      data: {
        status: callStatus,
        ...(callStatus === "CONNECTED" ? { answeredAt: new Date() } : {}),
        ...(isTerminalOutboundStatus(status)
          ? { endedAt: new Date(), durationSeconds: durationSeconds ?? undefined }
          : {}),
      },
    });
  }

  private async inferQualification(outbound: LoadedOutboundCall) {
    if (outbound.appointmentBooked) return true;
    if (outbound.lead?.status === "QUALIFIED" || outbound.lead?.status === "BOOKED") return true;
    if (!outbound.callId) return false;
    const summary = await this.prisma.callSummary.findUnique({ where: { callId: outbound.callId } });
    if (summary?.outcome === "QUALIFIED_LEAD" || summary?.outcome === "BOOKED_APPOINTMENT") {
      await this.prisma.outboundCall.update({
        where: { id: outbound.id },
        data: { summaryId: summary.id },
      });
      return true;
    }
    return false;
  }

  private async hasAppointment(outbound: LoadedOutboundCall) {
    if (!outbound.callId) return false;
    const appointment = await this.prisma.appointment.findFirst({
      where: { organizationId: outbound.organizationId, callId: outbound.callId },
      select: { id: true },
    });
    return Boolean(appointment);
  }

  private async markFailed(outboundCallId: string, organizationId: string, reason: string) {
    const outbound = await this.prisma.outboundCall.update({
      where: { id: outboundCallId },
      data: { status: "FAILED", endedAt: new Date(), lastError: reason.slice(0, 1000) },
      include: outboundInclude,
    });
    await Promise.all([
      this.timeline?.recordEvent({
        organizationId,
        customerProfileId: outbound.customerProfileId,
        eventType: "OUTBOUND_CALL_FAILED",
        sourceEntityType: "OutboundCall",
        sourceEntityId: outbound.id,
        idempotencyKey: `outbound-call:failed:${outbound.id}`,
        description: reason.slice(0, 500),
      }),
      this.audit(organizationId, "outbound_call.failed", outbound.id, { reason: reason.slice(0, 500) }),
    ]);
  }

  private audit(organizationId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditEvent.create({
      data: { organizationId, action, entityType: "OutboundCall", entityId, metadata },
    });
  }
}

const outboundInclude = {
  customerProfile: { select: { id: true, name: true, phone: true, email: true } },
  lead: { select: { id: true, status: true, score: true, metadata: true } },
  agent: { select: { id: true, name: true, status: true } },
  call: { select: { id: true, status: true, durationSeconds: true, callTranscriptId: true } },
  summary: { select: { id: true, outcome: true, sentiment: true, summary: true } },
  recording: { select: { id: true, status: true } },
  transcript: { select: { id: true, status: true } },
} satisfies Prisma.OutboundCallInclude;

type LoadedOutboundCall = Prisma.OutboundCallGetPayload<{ include: typeof outboundInclude }>;

function mapProviderStatus(status?: string | null): OutboundCallStatus {
  const normalized = status?.toLowerCase();
  if (normalized === "queued" || normalized === "initiated") return "DIALING";
  if (normalized === "ringing") return "RINGING";
  if (normalized === "in-progress" || normalized === "answered") return "IN_PROGRESS";
  if (normalized === "completed") return "COMPLETED";
  if (normalized === "busy") return "BUSY";
  if (normalized === "no-answer") return "NO_ANSWER";
  if (normalized === "canceled") return "CANCELLED";
  if (normalized === "failed") return "FAILED";
  return "DIALING";
}

function jsonString(value: Prisma.JsonValue, ...path: string[]) {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

function mergeJson(
  existing: Prisma.JsonValue | undefined,
  patch: Record<string, Prisma.InputJsonValue | null>,
) {
  return {
    ...((existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}) as Record<string, Prisma.InputJsonValue | null>),
    ...patch,
  } as Prisma.InputJsonObject;
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Outbound call failed.";
}

export function toOutboundCallResponse(outbound: LoadedOutboundCall) {
  return {
    id: outbound.id,
    organizationId: outbound.organizationId,
    customerProfileId: outbound.customerProfileId,
    leadId: outbound.leadId,
    callId: outbound.callId,
    agentId: outbound.agentId,
    reasonType: outbound.reasonType,
    reasonDescription: outbound.reasonDescription,
    status: outbound.status,
    attemptNumber: outbound.attemptNumber,
    scheduledAt: outbound.scheduledAt,
    startedAt: outbound.startedAt,
    endedAt: outbound.endedAt,
    durationSeconds: outbound.durationSeconds,
    appointmentBooked: outbound.appointmentBooked,
    qualified: outbound.qualified,
    summaryId: outbound.summaryId,
    recordingId: outbound.recordingId,
    transcriptId: outbound.transcriptId,
    provider: outbound.provider,
    providerCallSid: outbound.providerCallSid,
    lastError: outbound.lastError,
    customer: outbound.customerProfile,
    lead: outbound.lead,
    agent: outbound.agent,
    call: outbound.call,
    summary: outbound.summary,
    recording: outbound.recording,
    transcript: outbound.transcript,
    createdAt: outbound.createdAt,
    updatedAt: outbound.updatedAt,
  };
}
