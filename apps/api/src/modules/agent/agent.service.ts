import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { AgentStatus, Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type { CreateAgentDto, ListAgentsQueryDto, UpdateAgentDto } from "./dto/agent.dto";
import { AgentRepository } from "./repositories/agent.repository";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";

@Injectable()
export class AgentService {
  constructor(
    private readonly agents: AgentRepository,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
  ) {}

  capabilities() {
    return { resource: "agents", mode: "tenant-crud-ready" };
  }

  async create(context: TenantContext, input: CreateAgentDto) {
    await this.gates?.assertAvailable(context.organizationId, "agents");
    const agent = await this.agents.create({
      organizationId: context.organizationId,
      name: input.name.trim(),
      description: normalizeOptionalText(input.description),
      language: input.language,
      voice: input.voice,
      systemPrompt: input.systemPrompt.trim(),
      status: input.status as AgentStatus,
    });

    await this.audit(context, "agent.created", agent.id, {
      name: agent.name,
      status: agent.status,
    });
    await this.usage?.increment({
      organizationId: context.organizationId,
      resourceType: "AGENTS",
      idempotencyKey: `agent:create:${agent.id}`,
    });

    return this.toResponse(agent);
  }

  async list(context: TenantContext, query: ListAgentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const result = await this.agents.list({
      organizationId: context.organizationId,
      page,
      limit,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as AgentStatus | undefined,
    });

    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((agent) => this.toResponse(agent)),
    };
  }

  async getById(context: TenantContext, agentId: string) {
    const agent = await this.getScopedAgent(context.organizationId, agentId);
    return this.toResponse(agent);
  }

  async update(context: TenantContext, agentId: string, input: UpdateAgentDto) {
    const existing = await this.getScopedAgent(context.organizationId, agentId);
    const updateInput = this.toUpdateInput(input);

    await this.agents.update(context.organizationId, agentId, updateInput);
    const agent = await this.getScopedAgent(context.organizationId, agentId);

    await this.audit(context, "agent.updated", agent.id, {
      before: {
        name: existing.name,
        status: existing.status,
      },
      after: {
        name: agent.name,
        status: agent.status,
      },
    });

    return this.toResponse(agent);
  }

  async delete(context: TenantContext, agentId: string) {
    const agent = await this.getScopedAgent(context.organizationId, agentId);
    await this.agents.softDelete(context.organizationId, agentId);
    await this.audit(context, "agent.deleted", agent.id, {
      name: agent.name,
    });
    await this.usage?.decrement({
      organizationId: context.organizationId,
      resourceType: "AGENTS",
      idempotencyKey: `agent:delete:${agent.id}`,
    });

    return { success: true };
  }

  async duplicate(context: TenantContext, agentId: string) {
    await this.gates?.assertAvailable(context.organizationId, "agents");
    const source = await this.getScopedAgent(context.organizationId, agentId);
    const agent = await this.agents.create({
      organizationId: context.organizationId,
      name: truncate(`Copy of ${source.name}`, 100),
      description: source.description,
      language: source.language,
      voice: source.voice,
      systemPrompt: source.systemPrompt,
      status: "DRAFT",
    });

    await this.audit(context, "agent.duplicated", agent.id, {
      sourceAgentId: source.id,
      name: agent.name,
    });
    await this.usage?.increment({
      organizationId: context.organizationId,
      resourceType: "AGENTS",
      idempotencyKey: `agent:create:${agent.id}`,
      metadata: { sourceAgentId: source.id },
    });

    return this.toResponse(agent);
  }

  private async getScopedAgent(organizationId: string, agentId: string) {
    const agent = await this.agents.findById(organizationId, agentId);

    if (!agent) {
      throw new NotFoundException("Agent not found.");
    }

    return agent;
  }

  private toUpdateInput(input: UpdateAgentDto) {
    return {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalText(input.description) }
        : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.voice !== undefined ? { voice: input.voice } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status as AgentStatus } : {}),
    };
  }

  private toResponse(agent: {
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    language: string;
    voice: string;
    systemPrompt: string;
    status: AgentStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: agent.id,
      organizationId: agent.organizationId,
      name: agent.name,
      description: agent.description,
      language: agent.language,
      voice: agent.voice,
      systemPrompt: agent.systemPrompt,
      status: agent.status,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.agents.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "Agent",
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
