import { Injectable } from "@nestjs/common";
import type { ToolExecutionStatus } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type { ListToolExecutionsQueryDto } from "./dto/tool.dto";
import { ToolExecutionRepository } from "./repositories/tool-execution.repository";
import { ToolRegistryService } from "./tool-registry.service";

@Injectable()
export class ToolService {
  constructor(
    private readonly registry: ToolRegistryService,
    private readonly repository: ToolExecutionRepository,
  ) {}

  async listTools(context: TenantContext) {
    await this.registry.ensureCatalog(context.organizationId);
    return this.repository.listTools(context.organizationId);
  }

  async setEnabled(context: TenantContext, toolName: string, enabled: boolean) {
    await this.registry.ensureCatalog(context.organizationId);
    const tool = await this.repository.setToolEnabled(context.organizationId, toolName, enabled);
    await this.repository.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: enabled ? "tool.enabled" : "tool.disabled",
      entityType: "Tool",
      entityId: tool.id,
      metadata: { toolName },
    });
    return tool;
  }

  async executions(context: TenantContext, query: ListToolExecutionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.repository.listExecutions({
      organizationId: context.organizationId,
      page,
      limit,
      status: query.status as ToolExecutionStatus | undefined,
      toolName: query.toolName,
      conversationId: query.conversationId,
      callId: query.callId,
      agentId: query.agentId,
    });
    return { total: result.total, page, limit, data: result.data };
  }

  stats(context: TenantContext) {
    return this.repository.stats(context.organizationId);
  }
}
