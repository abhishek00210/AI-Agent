import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  ConversationChannel,
  ConversationSource,
  ConversationStatus,
  Prisma,
} from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type { CreateConversationDto, ListConversationsQueryDto } from "./dto/conversation.dto";
import { MessageRepository } from "./repositories/message.repository";
import { ConversationRepository } from "./repositories/conversation.repository";

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
  ) {}

  async create(context: TenantContext, input: CreateConversationDto) {
    const agent = await this.conversations.agentExists(context.organizationId, input.agentId);
    if (!agent) {
      throw new NotFoundException("Agent not found.");
    }

    const conversation = await this.conversations.create({
      organizationId: context.organizationId,
      agentId: input.agentId,
      channel: input.channel as ConversationChannel,
      sessionId: randomUUID(),
    });
    await this.audit(context, "conversation.created", conversation.id, {
      agentId: input.agentId,
      channel: input.channel,
    });

    return {
      conversationId: conversation.id,
      conversation: this.toConversationResponse(conversation),
    };
  }

  async list(context: TenantContext, query: ListConversationsQueryDto) {
    if (query.agentId) {
      const agent = await this.conversations.agentExists(context.organizationId, query.agentId);
      if (!agent) {
        throw new NotFoundException("Agent not found.");
      }
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const result = await this.conversations.list({
      organizationId: context.organizationId,
      page,
      limit,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as ConversationStatus | undefined,
      agentId: query.agentId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });

    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((conversation) => this.toConversationResponse(conversation)),
    };
  }

  async getById(context: TenantContext, conversationId: string) {
    const conversation = await this.getScopedConversation(context.organizationId, conversationId);
    const [tokenAggregate] = await Promise.all([
      this.messages.tokenSumByConversation(context.organizationId, conversationId),
    ]);
    return {
      ...this.toConversationResponse(conversation),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        organizationId: message.organizationId,
        conversationId: message.conversationId,
        senderType: message.senderType,
        content: message.content,
        messageType: message.messageType,
        tokenCount: message.tokenCount,
        metadata: message.metadata,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      })),
      statistics: {
        messageCount: conversation.messages.length,
        tokenCount: tokenAggregate._sum.tokenCount ?? 0,
        durationSeconds: calculateDurationSeconds(conversation.startedAt, conversation.endedAt),
      },
    };
  }

  async close(context: TenantContext, conversationId: string) {
    const conversation = await this.getScopedConversation(context.organizationId, conversationId);
    await this.conversations.updateStatus(
      context.organizationId,
      conversationId,
      "CLOSED",
      new Date(),
    );
    await this.audit(context, "conversation.closed", conversation.id);
    return this.getById(context, conversationId);
  }

  async archive(context: TenantContext, conversationId: string) {
    const conversation = await this.getScopedConversation(context.organizationId, conversationId);
    await this.conversations.updateStatus(
      context.organizationId,
      conversationId,
      "ARCHIVED",
      conversation.endedAt,
    );
    await this.audit(context, "conversation.archived", conversation.id);
    return this.getById(context, conversationId);
  }

  async delete(context: TenantContext, conversationId: string) {
    const conversation = await this.getScopedConversation(context.organizationId, conversationId);
    await this.conversations.softDelete(context.organizationId, conversationId);
    await this.audit(context, "conversation.deleted", conversation.id);
    return { success: true };
  }

  private async getScopedConversation(organizationId: string, conversationId: string) {
    const conversation = await this.conversations.findById(organizationId, conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }
    return conversation;
  }

  private toConversationResponse(conversation: {
    id: string;
    organizationId: string;
    agentId: string;
    visitorId: string | null;
    sessionId: string | null;
    channel: ConversationChannel;
    status: ConversationStatus;
    source: ConversationSource;
    startedAt: Date;
    lastMessageAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    agent: { id: string; name: string; status: string };
    _count: { messages: number };
  }) {
    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      agentId: conversation.agentId,
      agent: conversation.agent,
      visitorId: conversation.visitorId,
      sessionId: conversation.sessionId,
      channel: conversation.channel,
      status: conversation.status,
      source: conversation.source,
      messageCount: conversation._count.messages,
      startedAt: conversation.startedAt,
      lastMessageAt: conversation.lastMessageAt,
      endedAt: conversation.endedAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.conversations.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "Conversation",
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function calculateDurationSeconds(startedAt: Date, endedAt: Date | null): number {
  const end = endedAt ?? new Date();
  return Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000));
}
