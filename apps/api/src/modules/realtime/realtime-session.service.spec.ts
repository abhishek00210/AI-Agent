import { RealtimeSessionService } from "./realtime-session.service";

describe("RealtimeSessionService", () => {
  const sessions = {
    findByCallSessionId: jest.fn(),
    upsertConnecting: jest.fn(),
    createAuditEvent: jest.fn(),
    markClosedIfActive: jest.fn(),
  };
  const conversations = {
    create: jest.fn(),
    close: jest.fn(),
  };
  const persistence = {
    enqueue: jest.fn((task: () => Promise<unknown>) => {
      void task();
      return true;
    }),
  };
  const service = new RealtimeSessionService(
    sessions as never,
    conversations as never,
    persistence as never,
  );
  const context = {
    organizationId: "org-1",
    callId: "call-1",
    callSessionId: "call-session-1",
    agentId: "agent-1",
    agentName: "Reception",
    systemPrompt: "Be helpful.",
    language: "en-US",
    voice: "alloy" as const,
    knowledgeBaseIds: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reuses an existing voice conversation for duplicate stream starts", async () => {
    sessions.findByCallSessionId.mockResolvedValue({
      id: "realtime-1",
      conversationId: "conversation-1",
    });

    const result = await service.create(context, "MZ123");

    expect(result.conversationId).toBe("conversation-1");
    expect(conversations.create).not.toHaveBeenCalled();
    expect(sessions.upsertConnecting).not.toHaveBeenCalled();
  });

  it("creates a voice conversation and realtime session once", async () => {
    sessions.findByCallSessionId.mockResolvedValue(null);
    conversations.create.mockResolvedValue({ id: "conversation-1" });
    sessions.upsertConnecting.mockResolvedValue({
      id: "realtime-1",
      conversationId: "conversation-1",
    });

    const result = await service.create(context, "MZ123");

    expect(result.session.id).toBe("realtime-1");
    expect(conversations.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "agent-1",
      "MZ123",
    );
  });

  it("closes failed sessions and their conversations once", async () => {
    sessions.markClosedIfActive.mockResolvedValue({
      session: { id: "realtime-1", status: "FAILED" },
      changed: true,
    });

    await service.failed(
      "realtime-1",
      {
        organizationId: "org-1",
        userId: "public-voice-call",
        email: "voice-call@system.local",
        role: "MEMBER",
      },
      "conversation-1",
      "OpenAI disconnected",
    );

    expect(conversations.close).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "conversation-1",
    );
    expect(sessions.createAuditEvent).toHaveBeenCalledTimes(1);
  });
});
