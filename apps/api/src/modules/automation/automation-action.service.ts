import { Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { CommunicationService } from "../communication/communication.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { OutboundCallService } from "../outbound-call/outbound-call.service";
import { UsageService } from "../usage/usage.service";

type LoadedExecution = Prisma.AutomationExecutionGetPayload<{
  include: { workflow: true; rule: { include: { template: true } }; customerProfile: true };
}>;

@Injectable()
export class AutomationActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
    private readonly timeline: CustomerTimelineService,
    private readonly usage: UsageService,
    @Optional() private readonly outboundCalls?: OutboundCallService,
  ) {}

  async execute(execution: LoadedExecution) {
    const template = execution.rule.template;
    const body = render(template?.body ?? fallbackBody(execution.actionType), execution);
    if (execution.actionType === "SMS") {
      if (!execution.customerProfile.phone)
        throw new Error("Customer does not have an SMS-capable phone number.");
      const result = await this.communications.send(systemContext(execution.organizationId), {
        phone: execution.customerProfile.phone,
        message: body,
        metadata: {
          automationExecutionId: execution.id,
          reasonType: execution.reasonType,
          reasonDescription: execution.reasonDescription,
          followUpReason: execution.reasonDescription,
        },
      });
      return {
        communicationMessageId: result.messageId,
        threadId: result.threadId,
        dispatchStatus: result.status,
      } satisfies Prisma.InputJsonValue;
    }
    if (execution.actionType === "EMAIL") {
      if (!execution.customerProfile.email)
        throw new Error("Customer does not have an email address.");
      const email = await this.prisma.emailQueue.create({
        data: {
          organizationId: execution.organizationId,
          to: execution.customerProfile.email,
          subject: render(template?.subject ?? "Following up", execution),
          body,
          status: "PENDING",
        },
      });
      return {
        emailQueueId: email.id,
        dispatchStatus: email.status,
      } satisfies Prisma.InputJsonValue;
    }
    await this.usage.increment({
      organizationId: execution.organizationId,
      resourceType: "AUTOMATION_CALLS_SCHEDULED",
      idempotencyKey: `automation:call:${execution.id}`,
    });
    if (this.outboundCalls) {
      const outbound = await this.outboundCalls.startFromAutomation(execution);
      return {
        outboundCallId: outbound.id,
        callId: outbound.callId,
        status: outbound.status,
        providerCallSid: outbound.providerCallSid,
        reasonType: outbound.reasonType,
        reasonDescription: outbound.reasonDescription,
        nextEngineContract: outboundEngineContract(),
      } satisfies Prisma.InputJsonValue;
    }
    return {
      outboundCallTask: {
        customerProfileId: execution.customerProfileId,
        phone: execution.customerProfile.phone,
        reasonType: execution.reasonType,
        reasonDescription: execution.reasonDescription,
        reason: execution.reasonDescription,
        status: "QUEUED_FOR_OUTBOUND_CALL_ENGINE",
        nextEngineContract: outboundEngineContract(),
      },
    } satisfies Prisma.InputJsonValue;
  }

  async timelineEvent(
    execution: LoadedExecution,
    eventType: "FOLLOW_UP_SENT" | "FOLLOW_UP_FAILED",
  ) {
    return this.timeline.recordEvent({
      organizationId: execution.organizationId,
      customerProfileId: execution.customerProfileId,
      eventType,
      sourceEntityType: "AutomationExecution",
      sourceEntityId: execution.id,
      idempotencyKey: `automation:${eventType.toLowerCase()}:${execution.id}`,
      description: execution.reasonDescription,
      metadata: {
        actionType: execution.actionType,
        workflowId: execution.workflowId,
        reasonType: execution.reasonType,
      },
    });
  }
}

function systemContext(organizationId: string) {
  return {
    organizationId,
    userId: "public-automation",
    email: "automation@system.local",
    role: "ADMIN" as const,
  };
}

function render(value: string, execution: LoadedExecution) {
  const replacements: Record<string, string> = {
    firstName: execution.customerProfile.name.split(/\s+/)[0] ?? "there",
    customerName: execution.customerProfile.name,
    followUpReason: execution.reasonDescription,
  };
  return value
    .replace(
      /\{\{(firstName|customerName|followUpReason)\}\}/g,
      (_, key: string) => replacements[key] ?? "",
    )
    .trim();
}

function fallbackBody(action: string) {
  if (action === "SMS")
    return "Hi {{firstName}}, we're following up. Please let us know how we can help.";
  if (action === "EMAIL")
    return "Hi {{firstName}},\n\nWe're following up regarding: {{followUpReason}}";
  return "Outbound follow-up: {{followUpReason}}";
}

function outboundEngineContract() {
  return {
    humanPickup: "START_AI_CONVERSATION",
    voicemail: "LEAVE_SHORT_MESSAGE_OR_HANG_UP_PER_TENANT_SETTINGS",
    busy: "APPLY_RETRY_POLICY",
    noAnswer: "RECORD_TIMELINE_AND_UPDATE_WORKFLOW",
    summary: "USE_TRANSCRIPT_SUMMARY_TIMELINE_PIPELINE",
  };
}
