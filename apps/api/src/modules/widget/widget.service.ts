import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import type { Prisma, WidgetPosition, WidgetStatus } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { ResponseGenerationService } from "../openai/response-generation.service";
import type {
  CreateWidgetDto,
  ListWidgetsQueryDto,
  PublicWidgetChatDto,
  PublicWidgetConversationDto,
  PublicWidgetInitDto,
  UpdateWidgetDto,
} from "./dto/widget.dto";
import { WidgetRepository } from "./repositories/widget.repository";
import { WidgetRateLimitService } from "./widget-rate-limit.service";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";

@Injectable()
export class WidgetService {
  constructor(
    private readonly widgets: WidgetRepository,
    private readonly responses: ResponseGenerationService,
    private readonly rateLimits: WidgetRateLimitService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
  ) {}

  async list(context: TenantContext, query: ListWidgetsQueryDto) {
    const result = await this.widgets.list({
      organizationId: context.organizationId,
      search: query.search?.trim() || undefined,
    });
    return {
      total: result.total,
      data: result.data.map(toWidgetResponse),
    };
  }

  async getById(context: TenantContext, widgetId: string) {
    const widget = await this.getScopedWidget(context.organizationId, widgetId);
    return toWidgetResponse(widget);
  }

  async create(context: TenantContext, input: CreateWidgetDto) {
    await this.gates?.assertCapability(context.organizationId, "websiteWidget");
    await this.gates?.assertAvailable(context.organizationId, "widgets");
    await this.assertAgent(context.organizationId, input.agentId);
    const widget = await this.widgets.create({
      organizationId: context.organizationId,
      agentId: input.agentId,
      name: input.name.trim(),
      status: input.status as WidgetStatus,
      publicKey: generatePublicKey(),
      primaryColor: input.primaryColor,
      position: input.position as WidgetPosition,
      welcomeMessage: input.welcomeMessage.trim(),
    });
    await this.audit(context, "widget.created", widget.id, {
      agentId: widget.agentId,
      status: widget.status,
    });
    await this.usage?.increment({
      organizationId: context.organizationId,
      resourceType: "WIDGETS",
      idempotencyKey: `widget:create:${widget.id}`,
    });
    return toWidgetResponse(widget);
  }

  async update(context: TenantContext, widgetId: string, input: UpdateWidgetDto) {
    const existing = await this.getScopedWidget(context.organizationId, widgetId);
    if (input.agentId) {
      await this.assertAgent(context.organizationId, input.agentId);
    }
    await this.widgets.update(context.organizationId, widgetId, {
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status as WidgetStatus } : {}),
      ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      ...(input.position !== undefined ? { position: input.position as WidgetPosition } : {}),
      ...(input.welcomeMessage !== undefined
        ? { welcomeMessage: input.welcomeMessage.trim() }
        : {}),
    });
    const widget = await this.getScopedWidget(context.organizationId, widgetId);
    await this.audit(
      context,
      widget.status !== existing.status
        ? widget.status === "ACTIVE"
          ? "widget.enabled"
          : "widget.disabled"
        : "widget.updated",
      widget.id,
      { beforeStatus: existing.status, afterStatus: widget.status },
    );
    return toWidgetResponse(widget);
  }

  async delete(context: TenantContext, widgetId: string) {
    const widget = await this.getScopedWidget(context.organizationId, widgetId);
    await this.widgets.softDelete(context.organizationId, widgetId);
    await this.audit(context, "widget.deleted", widget.id);
    await this.usage?.decrement({
      organizationId: context.organizationId,
      resourceType: "WIDGETS",
      idempotencyKey: `widget:delete:${widget.id}`,
    });
    return { success: true };
  }

  async initialize(input: PublicWidgetInitDto, requestMeta: RequestMeta = {}) {
    await this.rateLimits.assertAllowed({
      widgetId: input.widgetId,
      action: "init",
      ip: requestMeta.ip,
    });
    const widget = await this.getPublicWidget(input);
    await this.widgets.createAuditEvent({
      organizationId: widget.organizationId,
      action: "widget.installed",
      entityType: "Widget",
      entityId: widget.id,
      metadata: { source: "public_init" },
    });
    return {
      widget: toPublicWidgetConfig(widget),
      agent: {
        id: widget.agent.id,
        name: widget.agent.name,
        status: widget.agent.status,
      },
    };
  }

  async createVisitorConversation(input: PublicWidgetConversationDto, requestMeta: RequestMeta) {
    await this.rateLimits.assertAllowed({
      widgetId: input.widgetId,
      action: "conversation",
      ip: requestMeta.ip,
      visitorId: input.visitorId,
    });
    const widget = await this.getPublicWidget(input);
    const visitorId = input.visitorId?.trim() || randomUUID();
    await this.widgets.upsertVisitor({
      organizationId: widget.organizationId,
      widgetId: widget.id,
      visitorId,
      ipHash: requestMeta.ip ? hashValue(requestMeta.ip) : null,
      userAgent: requestMeta.userAgent ?? null,
    });
    const existing = await this.widgets.conversationForVisitor({
      organizationId: widget.organizationId,
      agentId: widget.agentId,
      widgetId: widget.id,
      visitorId,
    });
    const conversation =
      existing ??
      (await this.widgets.createConversation({
        organizationId: widget.organizationId,
        agentId: widget.agentId,
        widgetId: widget.id,
        visitorId,
      }));
    await this.widgets.createAuditEvent({
      organizationId: widget.organizationId,
      action: existing ? "widget.conversation_continued" : "widget.conversation_created",
      entityType: "Conversation",
      entityId: conversation.id,
      metadata: { widgetId: widget.id, visitorId },
    });
    return {
      conversationId: conversation.id,
      visitorId,
      conversation: toConversationResponse(conversation),
    };
  }

  async sendMessage(input: PublicWidgetChatDto, requestMeta: RequestMeta) {
    await this.rateLimits.assertAllowed({
      widgetId: input.widgetId,
      action: "chat",
      ip: requestMeta.ip,
      visitorId: input.visitorId,
    });
    const widget = await this.getPublicWidget(input);
    await this.widgets.upsertVisitor({
      organizationId: widget.organizationId,
      widgetId: widget.id,
      visitorId: input.visitorId,
      ipHash: requestMeta.ip ? hashValue(requestMeta.ip) : null,
      userAgent: requestMeta.userAgent ?? null,
    });
    const conversation = await this.widgets.conversationForVisitor({
      organizationId: widget.organizationId,
      agentId: widget.agentId,
      widgetId: widget.id,
      visitorId: input.visitorId,
    });
    if (!conversation || conversation.id !== input.conversationId) {
      throw new UnauthorizedException("Widget conversation is invalid.");
    }
    const response = await this.responses.send(
      {
        userId: "public-widget",
        organizationId: widget.organizationId,
        email: "widget@public.local",
        role: "MEMBER",
      },
      {
        agentId: widget.agentId,
        conversationId: input.conversationId,
        message: input.message,
        source: "WIDGET",
      },
    );
    await this.widgets.createAuditEvent({
      organizationId: widget.organizationId,
      action: "widget.message_sent",
      entityType: "Widget",
      entityId: widget.id,
      metadata: {
        conversationId: input.conversationId,
        visitorId: input.visitorId,
        responseTime: response.responseTime,
      },
    });
    return response;
  }

  private async assertAgent(organizationId: string, agentId: string) {
    const agent = await this.widgets.agentExists(organizationId, agentId);
    if (!agent) {
      throw new NotFoundException("Agent not found.");
    }
    return agent;
  }

  private async getScopedWidget(organizationId: string, widgetId: string) {
    const widget = await this.widgets.findById(organizationId, widgetId);
    if (!widget) {
      throw new NotFoundException("Widget not found.");
    }
    return widget;
  }

  private async getPublicWidget(input: PublicWidgetInitDto) {
    const widget = await this.widgets.findPublicCandidate(input.widgetId, input.publicKey);
    if (!widget) {
      throw new UnauthorizedException("Widget credentials are invalid.");
    }
    if (widget.status !== "ACTIVE") {
      throw new ForbiddenException("Widget Disabled");
    }
    if (widget.agent.deletedAt || widget.agent.status === "INACTIVE") {
      throw new ForbiddenException("Widget Agent Unavailable");
    }
    await this.gates?.assertChatCapacity(widget.organizationId, 0);
    return widget;
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.widgets.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "Widget",
      entityId,
      metadata,
    });
  }
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

function generatePublicKey() {
  return `wpk_${randomBytes(32).toString("base64url")}`;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toWidgetResponse(widget: {
  id: string;
  organizationId: string;
  agentId: string;
  name: string;
  status: WidgetStatus;
  publicKey: string;
  primaryColor: string;
  position: WidgetPosition;
  welcomeMessage: string;
  createdAt: Date;
  updatedAt: Date;
  agent: { id: string; name: string; status: string };
}) {
  return {
    id: widget.id,
    organizationId: widget.organizationId,
    agentId: widget.agentId,
    agent: widget.agent,
    name: widget.name,
    status: widget.status,
    publicKey: widget.publicKey,
    primaryColor: widget.primaryColor,
    position: widget.position,
    welcomeMessage: widget.welcomeMessage,
    createdAt: widget.createdAt,
    updatedAt: widget.updatedAt,
  };
}

function toPublicWidgetConfig(widget: {
  id: string;
  name: string;
  primaryColor: string;
  position: WidgetPosition;
  welcomeMessage: string;
}) {
  return {
    id: widget.id,
    name: widget.name,
    primaryColor: widget.primaryColor,
    position: widget.position,
    welcomeMessage: widget.welcomeMessage,
  };
}

function toConversationResponse(conversation: {
  id: string;
  organizationId: string;
  agentId: string;
  visitorId: string | null;
  sessionId: string | null;
  channel: string;
  status: string;
  source: string;
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
