import { NotFoundException } from "@nestjs/common";
import { mapRealtimeVoice, RealtimeAgentContextService } from "./realtime-agent-context.service";

describe("RealtimeAgentContextService", () => {
  const sessions = {
    findCallSessionByStreamSid: jest.fn(),
    recentCustomerSummaries: jest.fn(),
  };
  const memory = {
    getPromptMemory: jest.fn(),
  };
  const service = new RealtimeAgentContextService(sessions as never, memory as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads tenant-scoped active agent context from the call session", async () => {
    sessions.findCallSessionByStreamSid.mockResolvedValue({
      id: "call-session-1",
      callId: "call-1",
      organizationId: "org-1",
      call: {
        organizationId: "org-1",
        callerNumber: "+14165550100",
        agent: {
          id: "agent-1",
          name: "Reception",
          systemPrompt: "Be helpful.",
          language: "en-US",
          voice: "nova",
          status: "ACTIVE",
          deletedAt: null,
          knowledgeBases: [{ id: "kb-1" }],
        },
      },
    });

    await expect(service.load("MZ123")).resolves.toEqual(
      expect.objectContaining({
        organizationId: "org-1",
        callId: "call-1",
        callerNumber: "+14165550100",
        agentId: "agent-1",
        voice: "coral",
        knowledgeBaseIds: ["kb-1"],
      }),
    );
  });

  it("injects bounded prior call summaries for a returning caller", async () => {
    memory.getPromptMemory.mockResolvedValue({ summary: "", facts: [] });
    sessions.recentCustomerSummaries.mockResolvedValue([
      {
        summary: "Customer requested a roof inspection.",
        intent: "Roof inspection",
        outcome: "BOOKED_APPOINTMENT",
        nextAction: "Visit scheduled Tuesday.",
        generatedAt: new Date("2026-06-20T10:00:00Z"),
      },
    ]);

    const instructions = await service.memoryInstructions(
      { organizationId: "org-1" } as never,
      "conversation-2",
      {
        organizationId: "org-1",
        callId: "call-2",
        callSessionId: "session-2",
        callerNumber: "+14165550100",
        agentId: "agent-1",
        agentName: "Reception",
        systemPrompt: "Be helpful.",
        language: "English",
        voice: "coral",
        knowledgeBaseIds: [],
      },
    );

    expect(instructions).toContain("Recent customer call context");
    expect(instructions).toContain("roof inspection");
    expect(sessions.recentCustomerSummaries).toHaveBeenCalledWith(
      "org-1",
      "+14165550100",
      "call-2",
    );
  });

  it("rejects inactive agents and orphaned streams", async () => {
    sessions.findCallSessionByStreamSid.mockResolvedValue({
      organizationId: "org-1",
      call: {
        organizationId: "org-1",
        agent: { status: "INACTIVE", deletedAt: null },
      },
    });

    await expect(service.load("MZ123")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps legacy agent voices to supported realtime voices", () => {
    expect(mapRealtimeVoice("fable")).toBe("verse");
    expect(mapRealtimeVoice("onyx")).toBe("cedar");
    expect(mapRealtimeVoice("nova")).toBe("coral");
    expect(mapRealtimeVoice("unsupported")).toBe("alloy");
  });
});
