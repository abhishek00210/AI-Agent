import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { estimateTokenCount } from "../embedding/chunking.service";
import type { TenantContext } from "../tenant/tenant.service";
import type { ListMessagesQueryDto, SendMessageDto } from "./dto/conversation.dto";
import { ConversationRepository } from "./repositories/conversation.repository";
import { MessageRepository } from "./repositories/message.repository";

@Injectable()
export class MessageService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
  ) {}

  async sendUserMessage(context: TenantContext, conversationId: string, input: SendMessageDto) {
    await this.assertConversation(context.organizationId, conversationId);
    const now = new Date();
    const message = await this.messages.create({
      organizationId: context.organizationId,
      conversationId,
      senderType: "USER",
      content: input.content.trim(),
      messageType: "TEXT",
      tokenCount: estimateTokenCount(input.content),
      metadata: { source: "internal_chat_test" },
    });
    await this.conversations.touch(context.organizationId, conversationId, now);
    await this.audit(context, "message.sent", message.id, { conversationId });
    return this.toMessageResponse(message);
  }

  async list(context: TenantContext, conversationId: string, query: ListMessagesQueryDto) {
    await this.assertConversation(context.organizationId, conversationId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const result = await this.messages.list({
      organizationId: context.organizationId,
      conversationId,
      page,
      limit,
    });
    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((message) => this.toMessageResponse(message)),
    };
  }

  private async assertConversation(organizationId: string, conversationId: string) {
    const conversation = await this.conversations.findById(organizationId, conversationId);
    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }
    return conversation;
  }

  private toMessageResponse(message: {
    id: string;
    organizationId: string;
    conversationId: string;
    senderType: string;
    content: string;
    messageType: string;
    tokenCount: number;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
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
      entityType: "Message",
      entityId,
      metadata,
    });
  }
}
