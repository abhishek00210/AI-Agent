import { Injectable } from "@nestjs/common";
import type { CommunicationChannel, CommunicationDirection } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class CommunicationThreadRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertThread(input: {
    organizationId: string;
    contactId: string;
    channel: CommunicationChannel;
    direction: CommunicationDirection;
    messageAt?: Date;
    incrementUnread?: boolean;
  }) {
    const lastMessageAt = input.messageAt ?? new Date();
    return this.prisma.communicationThread.upsert({
      where: {
        organizationId_contactId_channel: {
          organizationId: input.organizationId,
          contactId: input.contactId,
          channel: input.channel,
        },
      },
      create: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        channel: input.channel,
        lastMessageAt,
        lastDirection: input.direction,
        unreadCount: input.incrementUnread ? 1 : 0,
      },
      update: {
        lastMessageAt,
        lastDirection: input.direction,
        ...(input.incrementUnread ? { unreadCount: { increment: 1 } } : {}),
      },
    });
  }

  markRead(organizationId: string, threadId: string) {
    return this.prisma.communicationThread.update({
      where: { id: threadId, organizationId },
      data: { unreadCount: 0 },
    });
  }

  list(organizationId: string, page: number, limit: number) {
    const where = { organizationId };
    return this.prisma.$transaction([
      this.prisma.communicationThread.count({ where }),
      this.prisma.communicationThread.findMany({
        where,
        include: {
          contact: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  }

  findScoped(organizationId: string, threadId: string) {
    return this.prisma.communicationThread.findFirst({
      where: { id: threadId, organizationId },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
  }
}
