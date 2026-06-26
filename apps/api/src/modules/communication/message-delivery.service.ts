import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../../generated/prisma";
import { MessageRepository } from "./repositories/message.repository";
import { SMS_PROVIDER, type SMSProvider } from "./sms-provider";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";

@Injectable()
export class MessageDeliveryService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly provider: SMSProvider,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly customerTimeline?: CustomerTimelineService,
  ) {}

  async deliver(organizationId: string, messageId: string, retryAttempt = 0) {
    const message = await this.messages.findScoped(organizationId, messageId);
    if (!message) throw new Error("SMS message was not found for this tenant.");
    if (["SENT", "DELIVERED", "READ"].includes(message.status)) {
      await this.trackSent(organizationId, messageId, message.provider, message);
      return message;
    }
    const configuredNumber = await this.messages.sendingNumber(organizationId);
    const from = configuredNumber?.phoneNumber || this.config.get<string>("twilio.phoneNumber");
    if (!from) throw new Error("No active SMS-capable sender is configured.");

    await this.messages.markSending(organizationId, messageId);
    if (retryAttempt > 0) {
      await this.audit(organizationId, "sms.retried", messageId, { retryAttempt });
    }
    try {
      const result = await this.provider.send({
        organizationId,
        to: message.phone,
        from,
        body: message.body,
        statusCallbackUrl: `${this.webhookBaseUrl}/api/v1/webhooks/twilio/sms/status`,
      });
      const sent = await this.messages.markSent(
        organizationId,
        messageId,
        result.providerMessageId,
        result.provider,
      );
      await this.audit(organizationId, "sms.sent", messageId, {
        provider: result.provider,
        providerMessageId: result.providerMessageId,
      });
      await this.trackSent(organizationId, messageId, result.provider, message);
      return sent;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "SMS provider failed.";
      await this.messages.markFailed(organizationId, messageId, reason);
      await this.audit(organizationId, "sms.failed", messageId, { retryAttempt, reason });
      throw error;
    }
  }

  private audit(
    organizationId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.messages.audit({ organizationId, action, entityId, metadata });
  }

  private trackSent(
    organizationId: string,
    messageId: string,
    provider: string,
    message: Awaited<ReturnType<MessageRepository["findScoped"]>>,
  ) {
    const tasks: Promise<unknown>[] = [];
    if (this.usage)
      tasks.push(
        this.usage.increment({
          organizationId,
          resourceType: "SMS_MESSAGES",
          idempotencyKey: `sms:sent:${messageId}`,
          metadata: { provider },
        }),
      );
    if (message?.thread?.contactId)
      tasks.push(
        this.customerTimeline?.recordEvent({
          organizationId,
          contactId: message.thread.contactId,
          phone: message.phone,
          eventType: "SMS_SENT",
          description: message.body.slice(0, 160),
          sourceEntityType: "CommunicationMessage",
          sourceEntityId: messageId,
          idempotencyKey: `sms:sent:${messageId}`,
          metadata: { provider },
          occurredAt: message.sentAt ?? new Date(),
        }) ?? Promise.resolve(),
      );
    const automationExecutionId = jsonText(message?.metadata, "automationExecutionId");
    const followUpReason = jsonText(message?.metadata, "followUpReason");
    if (automationExecutionId && message?.thread?.contactId) {
      tasks.push(
        this.customerTimeline?.recordEvent({
          organizationId,
          contactId: message.thread.contactId,
          phone: message.phone,
          eventType: "FOLLOW_UP_SENT",
          description: followUpReason ?? "Automated follow-up sent.",
          sourceEntityType: "AutomationExecution",
          sourceEntityId: automationExecutionId,
          idempotencyKey: `automation:follow-up-sent:${automationExecutionId}`,
          metadata: { communicationMessageId: messageId, provider },
          occurredAt: message.sentAt ?? new Date(),
        }) ?? Promise.resolve(),
      );
      if (this.usage)
        tasks.push(
          this.usage.increment({
            organizationId,
            resourceType: "AUTOMATION_SMS_SENT",
            idempotencyKey: `automation:sms:${automationExecutionId}`,
          }),
        );
    }
    if (this.analytics)
      tasks.push(
        this.analytics.record({
          organizationId,
          eventType: "SMS_SENT",
          idempotencyKey: `sms:sent:${messageId}`,
          metadata: { provider },
        }),
      );
    return Promise.all(tasks).then(() => undefined);
  }

  private get webhookBaseUrl() {
    return this.config.getOrThrow<string>("voice.webhookBaseUrl").replace(/\/$/, "");
  }
}

function jsonText(value: Prisma.JsonValue | null | undefined, key: string) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value[key] === "string"
    ? value[key]
    : null;
}
