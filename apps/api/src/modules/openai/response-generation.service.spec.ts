import { ServiceUnavailableException } from "@nestjs/common";
import { ResponseGenerationService } from "./response-generation.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("ResponseGenerationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores user and assistant messages with RAG citations and token metadata", async () => {
    const deps = createDependencies();
    deps.contextService.load.mockResolvedValue(conversationFixture());
    deps.retrieval.search.mockResolvedValue([retrievedChunk]);
    deps.citations.build.mockReturnValue([sourceCitation]);
    deps.contextBuilder.build.mockReturnValue("Knowledge context");
    deps.memory.getPromptMemory.mockResolvedValue(promptMemory);
    deps.promptAssembly.instructions.mockReturnValue("Instructions");
    deps.promptAssembly.messages.mockReturnValue([{ role: "user", content: "Question" }]);
    deps.provider.generateResponse.mockResolvedValue({
      content: "We are open 9 to 5.",
      model: "gpt-5.2",
      tokenUsage: { promptTokens: 10, completionTokens: 6, totalTokens: 16 },
      raw: { id: "response-1" },
    });
    deps.messages.create
      .mockResolvedValueOnce(messageFixture("message-user", "USER", "What are your hours?", 4, {}))
      .mockResolvedValueOnce(
        messageFixture("message-assistant", "ASSISTANT", "We are open 9 to 5.", 16, {
          model: "gpt-5.2",
          tokenUsage: { promptTokens: 10, completionTokens: 6, totalTokens: 16 },
          sources: [sourceCitation],
          retrievalCount: 1,
          knowledgeBaseIds: ["kb-1"],
        }),
      );
    const service = createService(deps);

    const result = await service.send(context, {
      agentId: "agent-1",
      conversationId: "conversation-1",
      message: "What are your hours?",
    });

    expect(deps.contextService.load).toHaveBeenCalledWith({
      organizationId: "org-1",
      agentId: "agent-1",
      conversationId: "conversation-1",
    });
    expect(deps.retrieval.search).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", knowledgeBaseIds: ["kb-1"] }),
    );
    expect(deps.messages.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        senderType: "ASSISTANT",
        metadata: expect.objectContaining({
          model: "gpt-5.2",
          source: "CHAT_TEST",
          retrievalCount: 1,
          tokenUsage: { promptTokens: 10, completionTokens: 6, totalTokens: 16 },
        }),
      }),
    );
    expect(result.assistantMessage.senderType).toBe("ASSISTANT");
    expect(deps.promptAssembly.instructions).toHaveBeenCalledWith(
      expect.objectContaining({
        memorySummary: promptMemory.summary,
        memoryFacts: promptMemory.facts,
      }),
    );
    expect(deps.memory.maybeEnqueueRefresh).toHaveBeenCalledWith(context, "conversation-1");
    expect(result.sources).toEqual([sourceCitation]);
    expect(result.retrievedChunks).toEqual([retrievedChunk]);
    expect(result.metadata.memoryUsed).toBe(true);
    expect(result.metadata.memoryFactCount).toBe(1);
    expect(result.tokenUsage.totalTokens).toBe(16);
  });

  it("tags widget-originated user and assistant messages", async () => {
    const deps = createDependencies();
    deps.contextService.load.mockResolvedValue(conversationFixture({ knowledgeBases: [] }));
    deps.citations.build.mockReturnValue([]);
    deps.contextBuilder.build.mockReturnValue("");
    deps.memory.getPromptMemory.mockResolvedValue({ summary: null, facts: [] });
    deps.promptAssembly.instructions.mockReturnValue("Instructions");
    deps.promptAssembly.messages.mockReturnValue([{ role: "user", content: "Hello" }]);
    deps.provider.generateResponse.mockResolvedValue({
      content: "Hello back.",
      model: "gpt-5.2",
      tokenUsage: { promptTokens: 4, completionTokens: 3, totalTokens: 7 },
      raw: { id: "response-widget" },
    });
    deps.messages.create
      .mockResolvedValueOnce(messageFixture("message-user", "USER", "Hello", 2, {}))
      .mockResolvedValueOnce(
        messageFixture("message-assistant", "ASSISTANT", "Hello back.", 7, {}),
      );
    const service = createService(deps);

    await service.send(context, {
      agentId: "agent-1",
      conversationId: "conversation-1",
      message: "Hello",
      source: "WIDGET",
    });

    expect(deps.messages.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        senderType: "USER",
        metadata: { source: "WIDGET" },
      }),
    );
    expect(deps.messages.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        senderType: "ASSISTANT",
        metadata: expect.objectContaining({ source: "WIDGET" }),
      }),
    );
  });

  it("generates a response using prompt and history when the agent has no knowledge bases", async () => {
    const deps = createDependencies();
    deps.contextService.load.mockResolvedValue(
      conversationFixture({
        knowledgeBases: [],
        messages: [{ senderType: "USER", content: "Hi" }],
      }),
    );
    deps.citations.build.mockReturnValue([]);
    deps.contextBuilder.build.mockReturnValue("");
    deps.memory.getPromptMemory.mockResolvedValue({ summary: null, facts: [] });
    deps.promptAssembly.instructions.mockReturnValue("Instructions without knowledge");
    deps.promptAssembly.messages.mockReturnValue([
      { role: "user", content: "Hi" },
      { role: "user", content: "Can you help?" },
    ]);
    deps.provider.generateResponse.mockResolvedValue({
      content: "Yes, I can help.",
      model: "gpt-5.2",
      tokenUsage: { promptTokens: 8, completionTokens: 5, totalTokens: 13 },
      raw: { id: "response-2" },
    });
    deps.messages.create
      .mockResolvedValueOnce(messageFixture("message-user", "USER", "Can you help?", 4, {}))
      .mockResolvedValueOnce(
        messageFixture("message-assistant", "ASSISTANT", "Yes, I can help.", 13, {}),
      );
    const service = createService(deps);

    const result = await service.send(context, {
      agentId: "agent-1",
      conversationId: "conversation-1",
      message: "Can you help?",
    });

    expect(deps.retrieval.search).not.toHaveBeenCalled();
    expect(deps.provider.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: "Instructions without knowledge",
        messages: [
          { role: "user", content: "Hi" },
          { role: "user", content: "Can you help?" },
        ],
      }),
    );
    expect(result.sources).toEqual([]);
    expect(result.retrievedChunks).toEqual([]);
    expect(result.metadata.retrievalCount).toBe(0);
  });

  it("continues generating when RAG returns zero results", async () => {
    const deps = createDependencies();
    deps.contextService.load.mockResolvedValue(conversationFixture());
    deps.retrieval.search.mockResolvedValue([]);
    deps.citations.build.mockReturnValue([]);
    deps.contextBuilder.build.mockReturnValue("");
    deps.memory.getPromptMemory.mockResolvedValue({ summary: null, facts: [] });
    deps.promptAssembly.instructions.mockReturnValue("Instructions with no retrieved chunks");
    deps.promptAssembly.messages.mockReturnValue([{ role: "user", content: "Question" }]);
    deps.provider.generateResponse.mockResolvedValue({
      content: "I do not have that information, but I can still help with general guidance.",
      model: "gpt-5.2",
      tokenUsage: { promptTokens: 12, completionTokens: 10, totalTokens: 22 },
      raw: { id: "response-3" },
    });
    deps.messages.create
      .mockResolvedValueOnce(messageFixture("message-user", "USER", "Question", 2, {}))
      .mockResolvedValueOnce(
        messageFixture(
          "message-assistant",
          "ASSISTANT",
          "I do not have that information, but I can still help with general guidance.",
          22,
          {},
        ),
      );
    const service = createService(deps);

    const result = await service.send(context, {
      agentId: "agent-1",
      conversationId: "conversation-1",
      message: "Question",
    });

    expect(deps.retrieval.search).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", knowledgeBaseIds: ["kb-1"] }),
    );
    expect(deps.provider.generateResponse).toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.retrievedChunks).toEqual([]);
    expect(result.metadata.retrievalCount).toBe(0);
  });

  it("logs OpenAI failures without storing a partial assistant message", async () => {
    const deps = createDependencies();
    deps.contextService.load.mockResolvedValue(conversationFixture());
    deps.retrieval.search.mockResolvedValue([]);
    deps.citations.build.mockReturnValue([]);
    deps.contextBuilder.build.mockReturnValue("");
    deps.memory.getPromptMemory.mockResolvedValue({ summary: null, facts: [] });
    deps.promptAssembly.instructions.mockReturnValue("Instructions");
    deps.promptAssembly.messages.mockReturnValue([{ role: "user", content: "Question" }]);
    deps.provider.generateResponse.mockRejectedValue(
      new ServiceUnavailableException(
        "AI service is temporarily rate limited. Please try again shortly.",
      ),
    );
    deps.messages.create.mockResolvedValueOnce(
      messageFixture("message-user", "USER", "Question", 2, {}),
    );
    const service = createService(deps);

    await expect(
      service.send(context, {
        agentId: "agent-1",
        conversationId: "conversation-1",
        message: "Question",
      }),
    ).rejects.toThrow("AI service is temporarily rate limited. Please try again shortly.");

    expect(deps.messages.create).toHaveBeenCalledTimes(1);
    expect(deps.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ senderType: "USER" }),
    );
    expect(deps.messages.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ senderType: "ASSISTANT" }),
    );
    expect(deps.conversations.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "openai.failure",
        organizationId: "org-1",
        actorUserId: "user-1",
        metadata: expect.objectContaining({
          message: "AI service is temporarily rate limited. Please try again shortly.",
        }),
      }),
    );
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new ResponseGenerationService(
    deps.contextService as never,
    deps.retrieval as never,
    deps.contextBuilder as never,
    deps.citations as never,
    deps.promptAssembly as never,
    deps.provider as never,
    deps.conversations as never,
    deps.messages as never,
    deps.memory as never,
    deps.toolRegistry as never,
    deps.toolExecutor as never,
  );
}

function createDependencies() {
  return {
    contextService: { load: jest.fn() },
    retrieval: { search: jest.fn() },
    contextBuilder: { build: jest.fn() },
    citations: { build: jest.fn() },
    promptAssembly: { instructions: jest.fn(), messages: jest.fn() },
    provider: { generateResponse: jest.fn() },
    conversations: {
      touch: jest.fn().mockResolvedValue({ count: 1 }),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    messages: { create: jest.fn() },
    memory: {
      getPromptMemory: jest.fn().mockResolvedValue({ summary: null, facts: [] }),
      maybeEnqueueRefresh: jest.fn().mockResolvedValue({ queued: false, messageCount: 2 }),
    },
    toolRegistry: {
      availableForModel: jest.fn().mockResolvedValue([]),
    },
    toolExecutor: {
      execute: jest.fn(),
    },
  };
}

const promptMemory = {
  summary: "Caller asked about business hours.",
  facts: [
    {
      factType: "PREFERENCE",
      factKey: "preferred_callback_time",
      factValue: "next week",
      confidence: 0.88,
    },
  ],
};

function conversationFixture(
  overrides: Partial<{
    knowledgeBases: Array<{ id: string; name: string }>;
    messages: Array<{ senderType: string; content: string }>;
  }> = {},
) {
  return {
    id: "conversation-1",
    organizationId: "org-1",
    agentId: "agent-1",
    agent: {
      id: "agent-1",
      systemPrompt: "You are a receptionist.",
      knowledgeBases: overrides.knowledgeBases ?? [{ id: "kb-1", name: "Main KB" }],
    },
    messages: overrides.messages ?? [{ senderType: "USER", content: "Previous question" }],
  };
}

const retrievedChunk = {
  chunkId: "chunk-1",
  knowledgeBaseId: "kb-1",
  knowledgeBaseName: "Main KB",
  sourceId: "faq-1",
  sourceType: "faq" as const,
  sourceName: "Hours",
  chunkIndex: 0,
  chunkText: "Hours are 9 to 5.",
  tokenCount: 5,
  relevanceScore: 0.92,
};

const sourceCitation = {
  sourceId: "faq-1",
  sourceType: "faq" as const,
  sourceName: "Hours",
  relevanceScore: 0.92,
  chunkReference: 1,
  knowledgeBaseId: "kb-1",
  documentId: null,
  websiteSourceId: null,
  faqEntryId: "faq-1",
};

function messageFixture(
  id: string,
  senderType: "USER" | "ASSISTANT",
  content: string,
  tokenCount: number,
  metadata: object,
) {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id,
    organizationId: "org-1",
    conversationId: "conversation-1",
    senderType,
    content,
    messageType: "TEXT",
    tokenCount,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}
