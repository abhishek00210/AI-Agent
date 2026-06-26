import { Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { estimateTokenCount } from "../embedding/chunking.service";
import { MemoryService } from "../memory/memory.service";
import type { TenantContext } from "../tenant/tenant.service";
import { DeferredPersistenceService } from "./deferred-persistence.service";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";

@Injectable()
export class RealtimeConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly memory: MemoryService,
    private readonly persistence: DeferredPersistenceService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async create(context: TenantContext, agentId: string, streamSid: string) {
    const conversation = await this.conversations.create({
      organizationId: context.organizationId,
      agentId,
      channel: "VOICE",
      sessionId: streamSid,
    });
    this.persistence.enqueue(() =>
      this.audit(context.organizationId, "voice.conversation_started", conversation.id, {
        agentId,
        streamSid,
      }),
    );
    return conversation;
  }

  async storeUserTranscript(
    context: TenantContext,
    conversationId: string,
    transcript: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.storeMessage(context, conversationId, "USER", transcript, metadata);
  }

  async storeAssistantTranscript(
    context: TenantContext,
    conversationId: string,
    transcript: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const message = await this.storeMessage(
      context,
      conversationId,
      "ASSISTANT",
      transcript,
      metadata,
    );
    await this.memory.maybeEnqueueRefresh(context, conversationId);
    if (message) {
      const usage = readTokenUsage(metadata);
      const writes: Promise<unknown>[] = [];
      if (this.usage)
        writes.push(
          this.usage.increment({
            organizationId: context.organizationId,
            resourceType: "MESSAGES",
            idempotencyKey: `ai:message:${message.id}`,
          }),
        );
      if (this.usage && usage.promptTokens > 0)
        writes.push(
          this.usage.increment({
            organizationId: context.organizationId,
            resourceType: "AI_INPUT_TOKENS",
            quantity: usage.promptTokens,
            idempotencyKey: `ai:input-tokens:${message.id}`,
          }),
        );
      if (this.usage && usage.completionTokens > 0)
        writes.push(
          this.usage.increment({
            organizationId: context.organizationId,
            resourceType: "AI_OUTPUT_TOKENS",
            quantity: usage.completionTokens,
            idempotencyKey: `ai:output-tokens:${message.id}`,
          }),
        );
      await Promise.all(writes);
      await this.analytics?.record({
        organizationId: context.organizationId,
        eventType: "AI_RESPONSE",
        idempotencyKey: `ai:response:${message.id}`,
        metadata: { inputTokens: usage.promptTokens, outputTokens: usage.completionTokens },
      });
    }
    return message;
  }

  async close(context: TenantContext, conversationId: string) {
    await this.conversations.updateStatus(
      context.organizationId,
      conversationId,
      "CLOSED",
      new Date(),
    );
    await this.audit(context.organizationId, "voice.conversation_ended", conversationId);
  }

  private async storeMessage(
    context: TenantContext,
    conversationId: string,
    senderType: "USER" | "ASSISTANT",
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const normalized = content.trim();
    if (!normalized) {
      return null;
    }

    const message = await this.messages.create({
      organizationId: context.organizationId,
      conversationId,
      senderType,
      content: normalized,
      messageType: "TEXT",
      tokenCount: estimateTokenCount(normalized),
      metadata: metadata ?? { source: "realtime_voice" },
    });
    await this.conversations.touch(context.organizationId, conversationId, new Date());
    return message;
  }

  private audit(
    organizationId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.conversations.createAuditEvent({
      organizationId,
      action,
      entityType: "Conversation",
      entityId,
      metadata,
    });
  }
}

function readTokenUsage(metadata?: Prisma.InputJsonValue) {
  const value =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Prisma.JsonObject)
      : {};
  return {
    promptTokens: typeof value.promptTokens === "number" ? value.promptTokens : 0,
    completionTokens: typeof value.completionTokens === "number" ? value.completionTokens : 0,
  };
}
