import { Injectable } from "@nestjs/common";
import type { LeadSource, Prisma, ToolExecutionStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface ToolExecutionListOptions {
  organizationId: string;
  page: number;
  limit: number;
  status?: ToolExecutionStatus;
  toolName?: string;
  conversationId?: string;
  callId?: string;
  agentId?: string;
}

@Injectable()
export class ToolExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertCatalog(input: {
    organizationId: string;
    name: string;
    displayName: string;
    description: string;
    schema: Prisma.InputJsonValue;
  }) {
    return this.prisma.tool.upsert({
      where: { organizationId_name: { organizationId: input.organizationId, name: input.name } },
      create: { ...input, enabled: true },
      update: {
        displayName: input.displayName,
        description: input.description,
        schema: input.schema,
      },
    });
  }

  findTool(organizationId: string, name: string) {
    return this.prisma.tool.findUnique({
      where: { organizationId_name: { organizationId, name } },
    });
  }

  listTools(organizationId: string) {
    return this.prisma.tool.findMany({
      where: { organizationId },
      orderBy: { displayName: "asc" },
    });
  }

  setToolEnabled(organizationId: string, name: string, enabled: boolean) {
    return this.prisma.tool.update({
      where: { organizationId_name: { organizationId, name } },
      data: { enabled },
    });
  }

  findAgent(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  createExecution(input: {
    organizationId: string;
    callId?: string;
    conversationId?: string;
    agentId?: string;
    toolName: string;
    input: Prisma.InputJsonValue;
  }) {
    return this.prisma.toolExecution.create({
      data: {
        organizationId: input.organizationId,
        callId: input.callId,
        conversationId: input.conversationId,
        agentId: input.agentId,
        toolName: input.toolName,
        input: input.input,
        status: "PENDING",
      },
    });
  }

  markRunning(organizationId: string, executionId: string) {
    return this.prisma.toolExecution.update({
      where: { id: executionId, organizationId },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  }

  markSuccess(organizationId: string, executionId: string, output: Prisma.InputJsonValue) {
    return this.prisma.toolExecution.update({
      where: { id: executionId, organizationId },
      data: { status: "SUCCESS", output, completedAt: new Date(), error: null },
    });
  }

  markFailure(
    organizationId: string,
    executionId: string,
    status: Extract<ToolExecutionStatus, "FAILED" | "REJECTED">,
    error: string,
  ) {
    return this.prisma.toolExecution.update({
      where: { id: executionId, organizationId },
      data: { status, error: error.slice(0, 2000), completedAt: new Date() },
    });
  }

  async listExecutions(options: ToolExecutionListOptions) {
    const where: Prisma.ToolExecutionWhereInput = {
      organizationId: options.organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.toolName ? { toolName: options.toolName } : {}),
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      ...(options.callId ? { callId: options.callId } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
    };
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.toolExecution.count({ where }),
      this.prisma.toolExecution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.limit,
      }),
    ]);
    return { total, data };
  }

  async stats(organizationId: string) {
    const [total, success, failed, rejected, byTool] = await Promise.all([
      this.prisma.toolExecution.count({ where: { organizationId } }),
      this.prisma.toolExecution.count({ where: { organizationId, status: "SUCCESS" } }),
      this.prisma.toolExecution.count({ where: { organizationId, status: "FAILED" } }),
      this.prisma.toolExecution.count({ where: { organizationId, status: "REJECTED" } }),
      this.prisma.toolExecution.groupBy({
        by: ["toolName"],
        where: { organizationId },
        _count: { _all: true },
      }),
    ]);
    return {
      total,
      success,
      failed,
      rejected,
      successRate: total === 0 ? 0 : Math.round((success / total) * 100),
      failureRate: total === 0 ? 0 : Math.round(((failed + rejected) / total) * 100),
      byTool: byTool.map((item) => ({ toolName: item.toolName, count: item._count._all })),
    };
  }

  createAppointmentRequest(input: {
    organizationId: string;
    conversationId?: string;
    callId?: string;
    agentId?: string;
    name: string;
    phone: string;
    email?: string;
    preferredDate?: Date;
    notes?: string;
  }) {
    return this.prisma.appointmentRequest.create({ data: input });
  }

  createEmailQueue(input: {
    organizationId: string;
    conversationId?: string;
    to: string;
    subject: string;
    body: string;
  }) {
    return this.prisma.emailQueue.create({ data: input });
  }

  createSmsQueue(input: {
    organizationId: string;
    conversationId?: string;
    phone: string;
    message: string;
  }) {
    return this.prisma.smsQueue.create({ data: input });
  }

  async upsertContactAndLead(input: {
    organizationId: string;
    conversationId?: string;
    callId?: string;
    agentId?: string;
    name: string;
    phone?: string;
    email?: string;
    company?: string;
    notes?: string;
    source?: string;
  }) {
    const existing = await this.prisma.contact.findFirst({
      where: {
        organizationId: input.organizationId,
        OR: [
          ...(input.phone ? [{ phone: input.phone }] : []),
          ...(input.email ? [{ email: input.email }] : []),
        ],
      },
    });
    const contact = existing
      ? await this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: input.name || existing.name,
            phone: input.phone ?? existing.phone,
            email: input.email ?? existing.email,
            company: input.company ?? existing.company,
            notes: input.notes ?? existing.notes,
          },
        })
      : await this.prisma.contact.create({
          data: {
            organizationId: input.organizationId,
            name: input.name,
            phone: input.phone,
            email: input.email,
            company: input.company,
            notes: input.notes,
          },
        });
    const source = normalizeLeadSource(input.source);
    const lead = await this.prisma.lead.upsert({
      where: {
        organizationId_contactId_source: {
          organizationId: input.organizationId,
          contactId: contact.id,
          source,
        },
      },
      create: {
        organizationId: input.organizationId,
        contactId: contact.id,
        conversationId: input.conversationId,
        callId: input.callId,
        agentId: input.agentId,
        source,
        notes: input.notes,
      },
      update: {
        conversationId: input.conversationId,
        callId: input.callId,
        agentId: input.agentId,
        notes: input.notes,
      },
    });
    return { contact, lead };
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

function normalizeLeadSource(value?: string): LeadSource {
  if (value === "VOICE") return "VOICE";
  if (value === "CHAT") return "CHAT";
  if (value === "WIDGET") return "WIDGET";
  if (value === "MANUAL") return "MANUAL";
  if (value === "IMPORT") return "IMPORT";
  return "AI_AGENT";
}
