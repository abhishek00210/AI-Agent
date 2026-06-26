import { Injectable } from "@nestjs/common";
import type { ConversationChannel, ConversationStatus, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface ConversationListOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: ConversationStatus;
  agentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  agentExists(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  async list(options: ConversationListOptions) {
    const where = this.buildScopedWhere(options);
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: options.limit,
      }),
    ]);

    return { total, data };
  }

  findById(organizationId: string, conversationId: string) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId, deletedAt: null },
      include: {
        ...this.defaultInclude(),
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  create(input: {
    organizationId: string;
    agentId: string;
    channel: ConversationChannel;
    visitorId?: string | null;
    sessionId?: string | null;
  }) {
    return this.prisma.conversation.create({
      data: input,
      include: this.defaultInclude(),
    });
  }

  updateStatus(
    organizationId: string,
    conversationId: string,
    status: ConversationStatus,
    endedAt?: Date | null,
  ) {
    return this.prisma.conversation.updateMany({
      where: { id: conversationId, organizationId, deletedAt: null },
      data: { status, endedAt },
    });
  }

  touch(organizationId: string, conversationId: string, lastMessageAt: Date) {
    return this.prisma.conversation.updateMany({
      where: { id: conversationId, organizationId, deletedAt: null },
      data: { lastMessageAt },
    });
  }

  softDelete(organizationId: string, conversationId: string) {
    return this.prisma.conversation.updateMany({
      where: { id: conversationId, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
  }

  createAuditEvent(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }

  private buildScopedWhere(options: ConversationListOptions): Prisma.ConversationWhereInput {
    return {
      organizationId: options.organizationId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            createdAt: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
      ...(options.search
        ? {
            OR: [
              { id: { contains: options.search, mode: "insensitive" } },
              { visitorId: { contains: options.search, mode: "insensitive" } },
              { sessionId: { contains: options.search, mode: "insensitive" } },
              { agent: { name: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private defaultInclude() {
    return {
      agent: { select: { id: true, name: true, status: true } },
      _count: {
        select: {
          messages: { where: { deletedAt: null } },
        },
      },
    } satisfies Prisma.ConversationInclude;
  }
}
