import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { KnowledgeBaseStatus, Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type {
  AssignAgentDto,
  CreateKnowledgeBaseDto,
  ListKnowledgeBasesQueryDto,
  UpdateKnowledgeBaseDto,
} from "./dto/knowledge-base.dto";
import { KnowledgeBaseRepository } from "./repositories/knowledge-base.repository";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly knowledgeBases: KnowledgeBaseRepository,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
  ) {}

  async create(context: TenantContext, input: CreateKnowledgeBaseDto) {
    await this.gates?.assertAvailable(context.organizationId, "knowledgeBases");
    if (input.agentId) {
      await this.assertAgentBelongsToTenant(context.organizationId, input.agentId);
    }

    const knowledgeBase = await this.knowledgeBases.create({
      organizationId: context.organizationId,
      agentId: input.agentId ?? null,
      name: input.name.trim(),
      description: normalizeOptionalText(input.description),
      status: input.status as KnowledgeBaseStatus,
    });

    await this.audit(context, "knowledge_base.created", knowledgeBase.id, {
      name: knowledgeBase.name,
      status: knowledgeBase.status,
      agentId: knowledgeBase.agentId,
    });
    await this.usage?.increment({
      organizationId: context.organizationId,
      resourceType: "KNOWLEDGE_BASES",
      idempotencyKey: `knowledge-base:create:${knowledgeBase.id}`,
    });

    return this.toResponse(knowledgeBase);
  }

  async list(context: TenantContext, query: ListKnowledgeBasesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const result = await this.knowledgeBases.list({
      organizationId: context.organizationId,
      page,
      limit,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as KnowledgeBaseStatus | undefined,
    });

    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((knowledgeBase) => this.toResponse(knowledgeBase)),
    };
  }

  async getById(context: TenantContext, knowledgeBaseId: string) {
    const knowledgeBase = await this.getScopedKnowledgeBase(
      context.organizationId,
      knowledgeBaseId,
    );
    return this.toResponse(knowledgeBase);
  }

  async update(context: TenantContext, knowledgeBaseId: string, input: UpdateKnowledgeBaseDto) {
    const existing = await this.getScopedKnowledgeBase(context.organizationId, knowledgeBaseId);
    const updateInput = await this.toUpdateInput(context.organizationId, input);

    await this.knowledgeBases.update(context.organizationId, knowledgeBaseId, updateInput);
    const knowledgeBase = await this.getScopedKnowledgeBase(
      context.organizationId,
      knowledgeBaseId,
    );

    await this.audit(context, "knowledge_base.updated", knowledgeBase.id, {
      before: {
        name: existing.name,
        status: existing.status,
        agentId: existing.agentId,
      },
      after: {
        name: knowledgeBase.name,
        status: knowledgeBase.status,
        agentId: knowledgeBase.agentId,
      },
    });

    return this.toResponse(knowledgeBase);
  }

  async assignAgent(context: TenantContext, knowledgeBaseId: string, input: AssignAgentDto) {
    const existing = await this.getScopedKnowledgeBase(context.organizationId, knowledgeBaseId);

    if (input.agentId) {
      await this.assertAgentBelongsToTenant(context.organizationId, input.agentId);
    }

    await this.knowledgeBases.update(context.organizationId, knowledgeBaseId, {
      agentId: input.agentId ?? null,
    });
    const knowledgeBase = await this.getScopedKnowledgeBase(
      context.organizationId,
      knowledgeBaseId,
    );

    await this.audit(context, "knowledge_base.agent_assigned", knowledgeBase.id, {
      previousAgentId: existing.agentId,
      agentId: knowledgeBase.agentId,
    });

    return this.toResponse(knowledgeBase);
  }

  async delete(context: TenantContext, knowledgeBaseId: string) {
    const knowledgeBase = await this.getScopedKnowledgeBase(
      context.organizationId,
      knowledgeBaseId,
    );
    await this.knowledgeBases.softDelete(context.organizationId, knowledgeBaseId);
    await this.audit(context, "knowledge_base.deleted", knowledgeBase.id, {
      name: knowledgeBase.name,
    });
    await this.usage?.decrement({
      organizationId: context.organizationId,
      resourceType: "KNOWLEDGE_BASES",
      idempotencyKey: `knowledge-base:delete:${knowledgeBase.id}`,
    });

    return { success: true };
  }

  private async getScopedKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    const knowledgeBase = await this.knowledgeBases.findById(organizationId, knowledgeBaseId);

    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }

    return knowledgeBase;
  }

  private async assertAgentBelongsToTenant(organizationId: string, agentId: string) {
    const agent = await this.knowledgeBases.agentExists(organizationId, agentId);

    if (!agent) {
      throw new BadRequestException("Assigned agent is not available in this organization.");
    }
  }

  private async toUpdateInput(organizationId: string, input: UpdateKnowledgeBaseDto) {
    if (input.agentId) {
      await this.assertAgentBelongsToTenant(organizationId, input.agentId);
    }

    return {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalText(input.description) }
        : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId ?? null } : {}),
      ...(input.status !== undefined ? { status: input.status as KnowledgeBaseStatus } : {}),
    };
  }

  private toResponse(knowledgeBase: {
    id: string;
    organizationId: string;
    agentId: string | null;
    name: string;
    description: string | null;
    status: KnowledgeBaseStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    agent?: { id: string; name: string } | null;
    _count?: { documents: number };
  }) {
    return {
      id: knowledgeBase.id,
      organizationId: knowledgeBase.organizationId,
      agentId: knowledgeBase.agentId,
      name: knowledgeBase.name,
      description: knowledgeBase.description,
      status: knowledgeBase.status,
      assignedAgent: knowledgeBase.agent ?? null,
      documentsCount: knowledgeBase._count?.documents ?? 0,
      createdAt: knowledgeBase.createdAt,
      updatedAt: knowledgeBase.updatedAt,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.knowledgeBases.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "KnowledgeBase",
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
