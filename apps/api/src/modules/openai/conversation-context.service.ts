import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class ConversationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(input: { organizationId: string; conversationId: string; agentId: string }) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        deletedAt: null,
      },
      include: {
        agent: {
          include: {
            knowledgeBases: {
              where: { organizationId: input.organizationId, deletedAt: null },
              select: { id: true, name: true },
            },
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: MAX_HISTORY_MESSAGES,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    return {
      ...conversation,
      messages: [...conversation.messages].reverse(),
    };
  }
}
