import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type { ZodSchema } from "zod";

export interface ToolJsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition<TInput = unknown> {
  name: string;
  displayName: string;
  description: string;
  schema: ZodSchema<TInput>;
  jsonSchema: ToolJsonSchema;
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ToolExecutionContext {
  tenant: TenantContext;
  organizationId: string;
  agentId?: string;
  conversationId?: string;
  callId?: string;
  source: "CHAT" | "VOICE" | "WIDGET" | "TEST";
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Prisma.InputJsonValue;
}

export interface ExecuteToolInput {
  toolName: string;
  input: unknown;
  context: ToolExecutionContext;
}

export interface AiToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: ToolJsonSchema;
}

export interface AiToolCall {
  id?: string;
  callId: string;
  name: string;
  arguments: unknown;
}
