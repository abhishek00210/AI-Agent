import { ForbiddenException, forwardRef, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CommunicationStatus } from "../../../generated/prisma";
import { TwilioSignatureService } from "../twilio/twilio-signature.service";
import { normalizeE164 } from "../voice/e164";
import { CommunicationThreadService } from "./communication-thread.service";
import { MessageRepository } from "./repositories/message.repository";
import { CustomerResolverService } from "../customer/customer-resolver.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { AutomationEngineService } from "../automation/automation-engine.service";

@Injectable()
export class DeliveryWebhookService {
  constructor(
    private readonly signatures: TwilioSignatureService,
    private readonly config: ConfigService,
    private readonly messages: MessageRepository,
    private readonly threads: CommunicationThreadService,
    @Optional() private readonly customers?: CustomerResolverService,
    @Optional() private readonly customerTimeline?: CustomerTimelineService,
    @Optional() @Inject(forwardRef(() => AutomationEngineService)) private readonly automations?: AutomationEngineService,
  ) {}

  async status(params: Record<string, string>, signature?: string) {
    this.assertSignature("status", params, signature);
    const providerMessageId = params.MessageSid;
    if (!providerMessageId) throw new NotFoundException("Twilio message identifier is missing.");
    const message = await this.messages.findByProviderId(providerMessageId);
    if (!message) throw new NotFoundException("Communication message not found.");
    const status = mapTwilioStatus(params.MessageStatus);
    const existingMetadata =
      message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
        ? message.metadata
        : {};
    const updated = await this.messages.updateDelivery(message.id, status, {
      ...existingMetadata,
      providerStatus: params.MessageStatus ?? null,
      errorCode: params.ErrorCode ?? null,
    });
    if (["DELIVERED", "FAILED", "READ"].includes(status)) {
      await this.messages.audit({
        organizationId: message.organizationId,
        action:
          status === "FAILED" ? "sms.failed" : status === "READ" ? "sms.read" : "sms.delivered",
        entityId: message.id,
        metadata: { providerMessageId },
      });
    }
    return updated;
  }

  async inbound(params: Record<string, string>, signature?: string, endpoint = "inbound") {
    this.assertSignature(endpoint, params, signature);
    const to = normalizeE164(params.To ?? "");
    const from = normalizeE164(params.From ?? "");
    const body = (params.Body ?? "").trim().slice(0, 1600);
    const sender = await this.messages.receivingNumber(to);
    if (!sender) throw new NotFoundException("Receiving number is not configured.");
    const contact =
      (await this.messages.findContact(sender.organizationId, from)) ??
      (await this.messages.createContact(sender.organizationId, from));
    const thread = await this.threads.recordMessage({
      organizationId: sender.organizationId,
      contactId: contact.id,
      channel: "SMS",
      direction: "INBOUND",
    });
    const message = await this.messages.create({
      organizationId: sender.organizationId,
      threadId: thread.id,
      direction: "INBOUND",
      body,
      phone: from,
      status: "DELIVERED",
      providerMessageId: params.MessageSid,
      metadata: { providerStatus: "received" },
    });
    await this.customers?.resolveCustomer({ organizationId: sender.organizationId, contactId: contact.id, phone: from, interaction: "MESSAGE" });
    await this.automations?.cancelForContact(sender.organizationId, contact.id, ["NEW_LEAD", "NO_RESPONSE"], "Customer responded by SMS.");
    await this.customerTimeline?.recordEvent({
      organizationId: sender.organizationId,
      contactId: contact.id,
      phone: from,
      eventType: "SMS_RECEIVED",
      description: body.slice(0, 160),
      sourceEntityType: "CommunicationMessage",
      sourceEntityId: message.id,
      idempotencyKey: `sms:received:${message.id}`,
      metadata: { providerMessageId: params.MessageSid ?? null },
      occurredAt: message.createdAt,
    });
    return message;
  }

  private assertSignature(kind: string, params: Record<string, string>, signature?: string) {
    const suffix = kind ? `/${kind}` : "";
    const url = `${this.baseUrl}/api/v1/webhooks/twilio/sms${suffix}`;
    if (!this.signatures.validateRequest({ url, params, signature })) {
      throw new ForbiddenException("Invalid Twilio signature.");
    }
  }

  private get baseUrl() {
    return this.config.getOrThrow<string>("voice.webhookBaseUrl").replace(/\/$/, "");
  }
}

function mapTwilioStatus(status?: string): CommunicationStatus {
  if (status === "delivered") return "DELIVERED";
  if (status === "read") return "READ";
  if (["failed", "undelivered", "canceled"].includes(status ?? "")) return "FAILED";
  if (["accepted", "queued", "sending", "sent"].includes(status ?? "")) return "SENT";
  return "QUEUED";
}
