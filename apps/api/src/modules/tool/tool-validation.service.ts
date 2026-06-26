import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { ZodError } from "zod";
import type { ToolDefinition } from "./tool.types";
import { ToolExecutionRepository } from "./repositories/tool-execution.repository";

@Injectable()
export class ToolValidationService {
  constructor(private readonly repository: ToolExecutionRepository) {}

  async assertEnabled(organizationId: string, toolName: string) {
    const tool = await this.repository.findTool(organizationId, toolName);
    if (!tool || !tool.enabled) {
      throw new ForbiddenException("Tool is disabled or unavailable.");
    }
  }

  async assertAgentOwnership(organizationId: string, agentId?: string) {
    if (!agentId) {
      return;
    }
    const agent = await this.repository.findAgent(organizationId, agentId);
    if (!agent) {
      throw new ForbiddenException("Agent is not available for this workspace.");
    }
  }

  validateInput(tool: ToolDefinition, input: unknown) {
    try {
      return tool.schema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(`Invalid tool input: ${error.issues[0]?.message ?? "schema failed"}`);
      }
      throw error;
    }
  }
}
