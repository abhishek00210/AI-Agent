import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../../../generated/prisma";
import { estimateTokenCount } from "../embedding/chunking.service";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { ToolAuditService } from "./tool-audit.service";
import { ToolRegistryService } from "./tool-registry.service";
import { ToolValidationService } from "./tool-validation.service";
import { ToolExecutionRepository } from "./repositories/tool-execution.repository";
import type { ExecuteToolInput, ToolResult } from "./tool.types";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly registry: ToolRegistryService,
    private readonly validation: ToolValidationService,
    private readonly executions: ToolExecutionRepository,
    private readonly audit: ToolAuditService,
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationRepository,
    private readonly config: ConfigService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async execute(input: ExecuteToolInput) {
    await this.registry.ensureCatalog(input.context.organizationId);
    const execution = await this.executions.createExecution({
      organizationId: input.context.organizationId,
      callId: input.context.callId,
      conversationId: input.context.conversationId,
      agentId: input.context.agentId,
      toolName: input.toolName,
      input: input.input as Prisma.InputJsonValue,
    });
    await this.audit.event(input.context, "tool.requested", execution.id, {
      toolName: input.toolName,
    });

    const tool = this.registry.get(input.toolName);
    if (!tool) {
      return this.reject(input, execution.id, "Tool is not registered.");
    }

    try {
      await this.validation.assertEnabled(input.context.organizationId, input.toolName);
      await this.validation.assertAgentOwnership(
        input.context.organizationId,
        input.context.agentId,
      );
      const parsed = this.validation.validateInput(tool, input.input);
      await this.audit.event(input.context, "tool.validated", execution.id, {
        toolName: input.toolName,
      });
      await this.executions.markRunning(input.context.organizationId, execution.id);
      await this.audit.event(input.context, "tool.started", execution.id, {
        toolName: input.toolName,
      });
      await this.persistToolMessage(input, "TOOL_CALL", `Called ${input.toolName}`, {
        executionId: execution.id,
        toolName: input.toolName,
        input: parsed as Prisma.InputJsonValue,
      });
      const result = await runWithTimeout(
        tool.execute(parsed, input.context),
        this.toolTimeoutMs(),
      );
      const output = toJsonResult(result);
      const completed = await this.executions.markSuccess(
        input.context.organizationId,
        execution.id,
        output,
      );
      await this.persistToolMessage(input, "TOOL_RESULT", result.message, {
        executionId: execution.id,
        toolName: input.toolName,
        output,
      });
      await this.audit.event(input.context, "tool.executed", execution.id, {
        toolName: input.toolName,
      });
      await this.usage?.increment({
        organizationId: input.context.organizationId,
        resourceType: "TOOL_EXECUTIONS",
        idempotencyKey: `tool:success:${execution.id}`,
        metadata: { toolName: input.toolName },
      });
      await this.analytics?.record({
        organizationId: input.context.organizationId,
        eventType: "TOOL_EXECUTION",
        idempotencyKey: `tool:success:${execution.id}`,
        agentId: input.context.agentId,
        metadata: { toolName: input.toolName },
      });
      return { execution: completed, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      const rejected = isValidationOrPermissionError(error);
      const failed = await this.executions.markFailure(
        input.context.organizationId,
        execution.id,
        rejected ? "REJECTED" : "FAILED",
        message,
      );
      await this.persistToolMessage(input, "TOOL_RESULT", message, {
        executionId: execution.id,
        toolName: input.toolName,
        error: message,
      });
      await this.audit.event(
        input.context,
        rejected ? "tool.rejected" : "tool.failed",
        execution.id,
        {
          toolName: input.toolName,
          message,
        },
      );
      return {
        execution: failed,
        result: { success: false, message },
      };
    }
  }

  private async reject(input: ExecuteToolInput, executionId: string, reason: string) {
    const execution = await this.executions.markFailure(
      input.context.organizationId,
      executionId,
      "REJECTED",
      reason,
    );
    await this.audit.event(input.context, "tool.rejected", executionId, {
      toolName: input.toolName,
      reason,
    });
    return { execution, result: { success: false, message: reason } };
  }

  private toolTimeoutMs() {
    const configured = this.config.get<number>("tools.executionTimeoutMs");
    return typeof configured === "number" && Number.isFinite(configured) && configured > 0
      ? configured
      : 5_000;
  }

  private async persistToolMessage(
    input: ExecuteToolInput,
    messageType: "TOOL_CALL" | "TOOL_RESULT",
    content: string,
    metadata: Prisma.InputJsonObject,
  ) {
    if (!input.context.conversationId) return;
    const conversation = await this.conversations.findById(
      input.context.organizationId,
      input.context.conversationId,
    );
    if (!conversation) {
      throw new NotFoundException("Conversation not found for tool execution.");
    }
    const message = await this.messages.create({
      organizationId: input.context.organizationId,
      conversationId: input.context.conversationId,
      senderType: "SYSTEM",
      content,
      messageType,
      tokenCount: estimateTokenCount(content),
      metadata,
    });
    await this.conversations.touch(
      input.context.organizationId,
      input.context.conversationId,
      message.createdAt,
    );
  }
}

function toJsonResult(result: ToolResult): Prisma.InputJsonObject {
  return {
    success: result.success,
    message: result.message,
    data: result.data ?? null,
  };
}

function isValidationOrPermissionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    typeof (error as { getStatus?: unknown }).getStatus === "function" &&
    [400, 403].includes((error as { getStatus: () => number }).getStatus())
  );
}

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}
