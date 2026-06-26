import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { TenantContext } from "../tenant/tenant.service";

@Injectable()
export class ConversationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(context: TenantContext) {
    const where = { organizationId: context.organizationId, deletedAt: null };
    const [total, active, closed, conversations, messageAggregate] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({ where: { ...where, status: "ACTIVE" } }),
      this.prisma.conversation.count({ where: { ...where, status: "CLOSED" } }),
      this.prisma.conversation.findMany({
        where,
        select: {
          startedAt: true,
          endedAt: true,
          _count: { select: { messages: { where: { deletedAt: null } } } },
        },
        take: 500,
      }),
      this.prisma.message.aggregate({
        where: {
          organizationId: context.organizationId,
          deletedAt: null,
          conversation: { deletedAt: null },
        },
        _sum: { tokenCount: true },
      }),
    ]);

    const averageMessages =
      conversations.length > 0
        ? conversations.reduce((sum, conversation) => sum + conversation._count.messages, 0) /
          conversations.length
        : 0;
    const durations = conversations
      .filter((conversation) => conversation.endedAt)
      .map((conversation) => conversation.endedAt!.getTime() - conversation.startedAt.getTime());
    const averageDurationSeconds =
      durations.length > 0
        ? Math.round(
            durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 1000,
          )
        : 0;

    return {
      totalConversations: total,
      activeConversations: active,
      closedConversations: closed,
      averageMessages,
      averageDurationSeconds,
      totalTokens: messageAggregate._sum.tokenCount ?? 0,
    };
  }
}
