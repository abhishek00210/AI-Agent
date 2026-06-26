import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { ConversationSummaryService } from "./conversation-summary.service";
import { MemoryFactService } from "./memory-fact.service";
import type { MemoryJobContext } from "./memory.types";
import { MemoryRepository } from "./repositories/memory.repository";

@Injectable()
export class MemoryGenerationService {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly summaries: ConversationSummaryService,
    private readonly facts: MemoryFactService,
  ) {}

  async generate(input: MemoryJobContext) {
    const conversation = await this.repository.findConversation(
      input.organizationId,
      input.conversationId,
    );
    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    const [messages, tokenAggregate] = await Promise.all([
      this.repository.loadMessages(input.organizationId, input.conversationId),
      this.repository.tokenEstimate(input.organizationId, input.conversationId),
    ]);
    const messageCount = messages.length;
    const tokenEstimate =
      tokenAggregate._sum.tokenCount ??
      messages.reduce((total, message) => total + message.tokenCount, 0);

    const [summary, extractedFacts] = await Promise.all([
      this.summaries.summarize({ messages, userId: input.actorUserId }),
      this.facts.extract({ messages, userId: input.actorUserId }),
    ]);

    const [memory, storedFacts] = await Promise.all([
      this.repository.createMemory({
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        summary,
        messageCount,
        tokenEstimate,
      }),
      this.repository.replaceFacts(input.organizationId, input.conversationId, extractedFacts),
    ]);

    await this.audit(input, "memory.generated", memory.id, {
      conversationId: input.conversationId,
      messageCount,
      tokenEstimate,
      factCount: storedFacts.length,
    });

    if (storedFacts.length > 0) {
      await this.audit(input, "memory.facts_extracted", input.conversationId, {
        conversationId: input.conversationId,
        factCount: storedFacts.length,
      });
    }

    return { memory, facts: storedFacts };
  }

  private audit(
    input: MemoryJobContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.repository.createAuditEvent({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId === "public-widget" ? undefined : input.actorUserId,
      action,
      entityType: "ConversationMemory",
      entityId,
      metadata,
    });
  }
}
