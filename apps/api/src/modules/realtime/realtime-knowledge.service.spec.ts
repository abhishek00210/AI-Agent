import { RealtimeKnowledgeService } from "./realtime-knowledge.service";

describe("RealtimeKnowledgeService", () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === "openai.realtimeRagTimeoutMs") return 10;
      if (key === "openai.realtimeRagTopK") return 3;
      return undefined;
    }),
  };
  const repository = {
    latestKnowledgeUpdatedAt: jest.fn(),
    findStartupKnowledge: jest.fn(),
  };
  const retrieval = {
    search: jest.fn(),
  };
  const metrics = {
    now: jest.fn(() => performance.now()),
    observe: jest.fn(),
    increment: jest.fn(),
  };
  const service = new RealtimeKnowledgeService(
    config as never,
    repository as never,
    retrieval as never,
    metrics as never,
  );
  const context = {
    organizationId: "org-1",
    callId: "call-1",
    callSessionId: "session-1",
    agentId: "agent-1",
    agentName: "Reception",
    systemPrompt: "Be helpful.",
    language: "en-US",
    voice: "alloy" as const,
    knowledgeBaseIds: ["kb-1"],
    knowledgeBaseUpdatedAt: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("derives tenant and knowledge bases only from the active call context", async () => {
    retrieval.search.mockResolvedValue([]);

    await service.search(context, {
      query: "hours",
      organizationId: "attacker-org",
      knowledgeBaseIds: ["attacker-kb"],
    });

    expect(retrieval.search).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        knowledgeBaseIds: ["kb-1"],
        query: "hours",
        topK: 3,
      }),
    );
  });

  it("aborts timed-out retrieval and returns a graceful result", async () => {
    retrieval.search.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );

    await expect(service.search(context, { query: "slow knowledge" })).resolves.toEqual({
      success: false,
      message: "Knowledge is temporarily unavailable. Continue the conversation without it.",
      chunks: [],
    });
    expect(metrics.increment).toHaveBeenCalledWith("realtime_rag_timeouts");
    expect(metrics.increment).toHaveBeenCalledWith("realtime_rag_cancellations");
  });

  it("keeps concurrent retrieval scopes isolated by active call context", async () => {
    retrieval.search.mockResolvedValue([]);
    const secondContext = {
      ...context,
      organizationId: "org-2",
      agentId: "agent-2",
      knowledgeBaseIds: ["kb-2"],
    };

    await Promise.all([
      service.search(context, { query: "hours" }),
      service.search(secondContext, { query: "pricing" }),
    ]);

    expect(retrieval.search).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", knowledgeBaseIds: ["kb-1"] }),
    );
    expect(retrieval.search).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-2", knowledgeBaseIds: ["kb-2"] }),
    );
  });
});
