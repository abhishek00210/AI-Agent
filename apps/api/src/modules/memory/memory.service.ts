import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { MemoryGenerationService } from "./memory-generation.service";
import { MemoryQueue } from "./memory.queue";
import { MemoryRepository } from "./repositories/memory.repository";

const MEMORY_INTERVAL_MESSAGES = 20;

@Injectable()
export class MemoryService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly generation: MemoryGenerationService,
    private readonly queue: MemoryQueue,
  ) {}

  async getConversationMemory(context: TenantContext, conversationId: string) {
    await this.assertConversation(context.organizationId, conversationId);
    const [summary, facts, history, memoryUpdates, messageCount, tokenAggregate] =
      await Promise.all([
        this.repository.latestMemory(context.organizationId, conversationId),
        this.repository.listFacts(context.organizationId, conversationId),
        this.repository.memoryHistory(context.organizationId, conversationId),
        this.repository.countMemoryUpdates(context.organizationId, conversationId),
        this.repository.countMessages(context.organizationId, conversationId),
        this.repository.tokenEstimate(context.organizationId, conversationId),
      ]);
    const totalConversationTokens = tokenAggregate._sum.tokenCount ?? 0;
    const memoryTokens = (summary?.tokenEstimate ?? 0) + estimateFactsTokens(facts);

    return {
      summary: summary ? toMemoryResponse(summary) : null,
      facts: facts.map(toFactResponse),
      history: history.map(toMemoryResponse),
      statistics: {
        messagesProcessed: summary?.messageCount ?? 0,
        currentMessageCount: messageCount,
        memoryUpdates,
        tokenSavingsEstimate: Math.max(0, totalConversationTokens - memoryTokens),
        factCount: facts.length,
      },
    };
  }

  async getFacts(context: TenantContext, conversationId: string) {
    await this.assertConversation(context.organizationId, conversationId);
    const facts = await this.repository.listFacts(context.organizationId, conversationId);
    return facts.map(toFactResponse);
  }

  async getPromptMemory(context: TenantContext, conversationId: string) {
    await this.assertConversation(context.organizationId, conversationId);
    const [summary, facts] = await Promise.all([
      this.repository.latestMemory(context.organizationId, conversationId),
      this.repository.listFacts(context.organizationId, conversationId),
    ]);

    return {
      summary: summary?.summary ?? null,
      facts: facts.map((fact) => ({
        factType: fact.factType,
        factKey: fact.factKey,
        factValue: fact.factValue,
        confidence: fact.confidence,
      })),
    };
  }

  async refresh(context: TenantContext, conversationId: string) {
    await this.assertConversation(context.organizationId, conversationId);
    const result = await this.generation.generate({
      organizationId: context.organizationId,
      conversationId,
      actorUserId: context.userId,
    });
    await this.audit(context, "memory.refreshed", result.memory.id, { conversationId });
    return this.getConversationMemory(context, conversationId);
  }

  async deleteFact(context: TenantContext, factId: string) {
    const result = await this.repository.deleteFact(context.organizationId, factId);
    if (result.count === 0) {
      throw new NotFoundException("Memory fact not found.");
    }
    await this.audit(context, "memory.fact_deleted", factId);
    return { success: true };
  }

  async maybeEnqueueRefresh(context: TenantContext, conversationId: string) {
    const messageCount = await this.repository.countMessages(
      context.organizationId,
      conversationId,
    );
    if (messageCount < MEMORY_INTERVAL_MESSAGES || messageCount % MEMORY_INTERVAL_MESSAGES !== 0) {
      return { queued: false, messageCount };
    }

    const latest = await this.repository.latestMemory(context.organizationId, conversationId);
    if (latest && latest.messageCount >= messageCount) {
      return { queued: false, messageCount };
    }

    try {
      await this.queue.enqueueRefresh(
        {
          organizationId: context.organizationId,
          conversationId,
          actorUserId: context.userId,
        },
        messageCount,
      );
      return { queued: true, messageCount };
    } catch (error) {
      await this.audit(context, "memory.queue_failed", conversationId, {
        conversationId,
        messageCount,
        message: error instanceof Error ? error.message : "Memory queue failed.",
      });
      return { queued: false, messageCount };
    }
  }

  private async assertConversation(organizationId: string, conversationId: string) {
    const conversation = await this.repository.findConversation(organizationId, conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }
    return conversation;
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.repository.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId:
        context.userId === "public-widget" || context.userId === "public-voice-call"
          ? undefined
          : context.userId,
      action,
      entityType: "ConversationMemory",
      entityId,
      metadata,
    });
  }
}

function estimateFactsTokens(facts: Array<{ factKey: string; factValue: string }>): number {
  return Math.ceil(
    facts.reduce((total, fact) => total + fact.factKey.length + fact.factValue.length, 0) / 4,
  );
}

function toMemoryResponse(memory: {
  id: string;
  organizationId: string;
  conversationId: string;
  summary: string;
  messageCount: number;
  tokenEstimate: number;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return memory;
}

function toFactResponse(fact: {
  id: string;
  organizationId: string;
  conversationId: string;
  factType: string;
  factKey: string;
  factValue: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return fact;
}
