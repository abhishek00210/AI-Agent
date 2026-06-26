import { Injectable } from "@nestjs/common";
import type { Prisma, WidgetPosition, WidgetStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class WidgetRepository {
  constructor(private readonly prisma: PrismaService) {}

  agentExists(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  async list(options: { organizationId: string; search?: string }) {
    const where: Prisma.WidgetWhereInput = {
      organizationId: options.organizationId,
      deletedAt: null,
      ...(options.search ? { name: { contains: options.search, mode: "insensitive" } } : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.widget.count({ where }),
      this.prisma.widget.findMany({
        where,
        include: { agent: { select: { id: true, name: true, status: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { total, data };
  }

  findById(organizationId: string, widgetId: string) {
    return this.prisma.widget.findFirst({
      where: { id: widgetId, organizationId, deletedAt: null },
      include: { agent: { select: { id: true, name: true, status: true } } },
    });
  }

  findPublicCandidate(widgetId: string, publicKey: string) {
    return this.prisma.widget.findFirst({
      where: {
        id: widgetId,
        publicKey,
        deletedAt: null,
      },
      include: {
        agent: {
          select: {
            id: true,
            organizationId: true,
            name: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  create(input: {
    organizationId: string;
    agentId: string;
    name: string;
    status: WidgetStatus;
    publicKey: string;
    primaryColor: string;
    position: WidgetPosition;
    welcomeMessage: string;
  }) {
    return this.prisma.widget.create({
      data: input,
      include: { agent: { select: { id: true, name: true, status: true } } },
    });
  }

  update(
    organizationId: string,
    widgetId: string,
    input: Partial<{
      agentId: string;
      name: string;
      status: WidgetStatus;
      primaryColor: string;
      position: WidgetPosition;
      welcomeMessage: string;
    }>,
  ) {
    return this.prisma.widget.updateMany({
      where: { id: widgetId, organizationId, deletedAt: null },
      data: input,
    });
  }

  softDelete(organizationId: string, widgetId: string) {
    return this.prisma.widget.updateMany({
      where: { id: widgetId, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  }

  upsertVisitor(input: {
    organizationId: string;
    widgetId: string;
    visitorId: string;
    ipHash?: string | null;
    userAgent?: string | null;
  }) {
    return this.prisma.widgetVisitor.upsert({
      where: {
        widgetId_visitorId: {
          widgetId: input.widgetId,
          visitorId: input.visitorId,
        },
      },
      create: input,
      update: {
        ipHash: input.ipHash,
        userAgent: input.userAgent,
      },
    });
  }

  conversationForVisitor(input: {
    organizationId: string;
    agentId: string;
    visitorId: string;
    widgetId: string;
  }) {
    return this.prisma.conversation.findFirst({
      where: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        visitorId: input.visitorId,
        channel: "WEB_CHAT",
        status: "ACTIVE",
        source: "WIDGET",
        deletedAt: null,
        sessionId: `widget:${input.widgetId}:${input.visitorId}`,
      },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        _count: { select: { messages: { where: { deletedAt: null } } } },
      },
    });
  }

  createConversation(input: {
    organizationId: string;
    agentId: string;
    visitorId: string;
    widgetId: string;
  }) {
    return this.prisma.conversation.create({
      data: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        visitorId: input.visitorId,
        sessionId: `widget:${input.widgetId}:${input.visitorId}`,
        channel: "WEB_CHAT",
        source: "WIDGET",
      },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        _count: { select: { messages: { where: { deletedAt: null } } } },
      },
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
}
