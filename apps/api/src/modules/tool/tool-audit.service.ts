import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { ToolExecutionContext } from "./tool.types";
import { ToolExecutionRepository } from "./repositories/tool-execution.repository";

@Injectable()
export class ToolAuditService {
  private readonly logger = new Logger(ToolAuditService.name);

  constructor(private readonly repository: ToolExecutionRepository) {}

  async event(
    context: ToolExecutionContext,
    action:
      | "tool.requested"
      | "tool.validated"
      | "tool.started"
      | "tool.executed"
      | "tool.failed"
      | "tool.rejected",
    executionId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    try {
      await this.repository.createAuditEvent({
        organizationId: context.organizationId,
        actorUserId: context.tenant.userId.startsWith("public-")
          ? undefined
          : context.tenant.userId,
        action,
        entityType: "ToolExecution",
        entityId: executionId,
        metadata,
      });
    } catch {
      this.logger.warn(`Tool audit write skipped for ${action}.`);
    }
  }
}
