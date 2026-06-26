import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { z } from "zod";
import { ToolExecutorService } from "./tool-executor.service";
import type { ToolDefinition, ToolExecutionContext } from "./tool.types";

describe("ToolExecutorService", () => {
  it("validates, executes, persists messages, and audits successful tool calls", async () => {
    const deps = createDeps();
    const handler = jest.fn().mockResolvedValue({
      success: true,
      message: "Lead created.",
      data: { leadId: "lead-1" },
    });
    deps.registry.get.mockReturnValue(tool(handler));
    const service = createService(deps);

    const result = await service.execute({
      toolName: "create_lead",
      input: { name: "Ada", email: "ada@example.com" },
      context: context(),
    });

    expect(deps.registry.ensureCatalog).toHaveBeenCalledWith("org-1");
    expect(deps.validation.assertEnabled).toHaveBeenCalledWith("org-1", "create_lead");
    expect(deps.validation.assertAgentOwnership).toHaveBeenCalledWith("org-1", "agent-1");
    expect(handler).toHaveBeenCalledWith(
      { name: "Ada", email: "ada@example.com" },
      expect.objectContaining({ organizationId: "org-1" }),
    );
    expect(deps.executions.markSuccess).toHaveBeenCalledWith(
      "org-1",
      "execution-1",
      expect.objectContaining({ success: true }),
    );
    expect(deps.audit.event).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "tool.validated",
      "execution-1",
      expect.objectContaining({ toolName: "create_lead" }),
    );
    expect(deps.audit.event).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "tool.started",
      "execution-1",
      expect.objectContaining({ toolName: "create_lead" }),
    );
    expect(deps.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ messageType: "TOOL_CALL", senderType: "SYSTEM" }),
    );
    expect(deps.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ messageType: "TOOL_RESULT", senderType: "SYSTEM" }),
    );
    expect(result.result.success).toBe(true);
  });

  it("rejects disabled tools before executing the handler", async () => {
    const deps = createDeps();
    const handler = jest.fn();
    deps.registry.get.mockReturnValue(tool(handler));
    deps.validation.assertEnabled.mockRejectedValue(new ForbiddenException("Tool is disabled."));
    const service = createService(deps);

    const result = await service.execute({
      toolName: "create_lead",
      input: { name: "Ada", email: "ada@example.com" },
      context: context(),
    });

    expect(handler).not.toHaveBeenCalled();
    expect(deps.executions.markFailure).toHaveBeenCalledWith(
      "org-1",
      "execution-1",
      "REJECTED",
      "Tool is disabled.",
    );
    expect(result.result.success).toBe(false);
  });

  it("rejects invalid payloads before executing the handler", async () => {
    const deps = createDeps();
    const handler = jest.fn();
    deps.registry.get.mockReturnValue(tool(handler));
    deps.validation.validateInput.mockImplementation(() => {
      throw new BadRequestException("Invalid tool input.");
    });
    const service = createService(deps);

    const result = await service.execute({
      toolName: "create_lead",
      input: { name: "" },
      context: context(),
    });

    expect(handler).not.toHaveBeenCalled();
    expect(deps.executions.markFailure).toHaveBeenCalledWith(
      "org-1",
      "execution-1",
      "REJECTED",
      "Invalid tool input.",
    );
    expect(result.result.success).toBe(false);
  });

  it("fails timed-out tools without throwing out of the conversation flow", async () => {
    jest.useFakeTimers();
    const deps = createDeps();
    const handler = jest.fn(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, message: "ok" }), 10_000)),
    );
    deps.registry.get.mockReturnValue(tool(handler));
    deps.config.get.mockReturnValue(50);
    const service = createService(deps);

    const resultPromise = service.execute({
      toolName: "create_lead",
      input: { name: "Ada", email: "ada@example.com" },
      context: context(),
    });
    await jest.advanceTimersByTimeAsync(51);
    const result = await resultPromise;

    expect(deps.executions.markFailure).toHaveBeenCalledWith(
      "org-1",
      "execution-1",
      "FAILED",
      "Tool execution timed out after 50ms.",
    );
    expect(result.result).toEqual({
      success: false,
      message: "Tool execution timed out after 50ms.",
    });
    jest.useRealTimers();
  });
});

function createService(deps: ReturnType<typeof createDeps>) {
  return new ToolExecutorService(
    deps.registry as never,
    deps.validation as never,
    deps.executions as never,
    deps.audit as never,
    deps.messages as never,
    deps.conversations as never,
    deps.config as never,
  );
}

function createDeps() {
  return {
    registry: {
      ensureCatalog: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    },
    validation: {
      assertEnabled: jest.fn().mockResolvedValue(undefined),
      assertAgentOwnership: jest.fn().mockResolvedValue(undefined),
      validateInput: jest.fn((definition: ToolDefinition, input: unknown) =>
        definition.schema.parse(input),
      ),
    },
    executions: {
      createExecution: jest.fn().mockResolvedValue({ id: "execution-1" }),
      markRunning: jest.fn().mockResolvedValue({ id: "execution-1", status: "RUNNING" }),
      markSuccess: jest.fn().mockResolvedValue({ id: "execution-1", status: "SUCCESS" }),
      markFailure: jest.fn().mockResolvedValue({ id: "execution-1", status: "REJECTED" }),
    },
    audit: {
      event: jest.fn().mockResolvedValue({}),
    },
    messages: {
      create: jest.fn().mockResolvedValue({ createdAt: new Date() }),
    },
    conversations: {
      findById: jest.fn().mockResolvedValue({ id: "conversation-1" }),
      touch: jest.fn().mockResolvedValue({ count: 1 }),
    },
    config: {
      get: jest.fn().mockReturnValue(undefined),
    },
  };
}

function tool(handler: jest.Mock): ToolDefinition<{ name: string; email: string }> {
  return {
    name: "create_lead",
    displayName: "Create Lead",
    description: "Create a lead.",
    schema: z.object({ name: z.string().min(1), email: z.string().email() }),
    jsonSchema: {
      type: "object",
      properties: { name: { type: "string" }, email: { type: "string" } },
      required: ["name", "email"],
      additionalProperties: false,
    },
    execute: handler,
  };
}

function context(): ToolExecutionContext {
  return {
    tenant: {
      userId: "user-1",
      organizationId: "org-1",
      email: "ada@example.com",
      role: "OWNER",
    },
    organizationId: "org-1",
    agentId: "agent-1",
    conversationId: "conversation-1",
    callId: "call-1",
    source: "TEST",
  };
}
