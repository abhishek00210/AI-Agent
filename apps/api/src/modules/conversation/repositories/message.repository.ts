import { Injectable } from "@nestjs/common";
import type { MessageType, Prisma, SenderType } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: {
    organizationId: string;
    conversationId: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.MessageWhereInput = {
      organizationId: options.organizationId,
      conversationId: options.conversationId,
      deletedAt: null,
    };
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: options.limit,
      }),
    ]);

    return { total, data };
  }

  create(input: {
    organizationId: string;
    conversationId: string;
    senderType: SenderType;
    content: string;
    messageType: MessageType;
    tokenCount: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.message.create({ data: input });
  }

  countByConversation(organizationId: string, conversationId: string) {
    return this.prisma.message.count({
      where: {
        organizationId,
        conversationId,
        deletedAt: null,
        conversation: { deletedAt: null },
      },
    });
  }

  tokenSumByConversation(organizationId: string, conversationId: string) {
    return this.prisma.message.aggregate({
      where: {
        organizationId,
        conversationId,
        deletedAt: null,
        conversation: { deletedAt: null },
      },
      _sum: { tokenCount: true },
    });
  }
}
