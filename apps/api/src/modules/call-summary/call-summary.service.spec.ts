import { NotFoundException } from "@nestjs/common";
import { CallSummaryService } from "./call-summary.service";

describe("CallSummaryService", () => {
  const repository = {
    transcriptContext: jest.fn(),
    upsert: jest.fn(),
    createAuditEvent: jest.fn(),
    findById: jest.fn(),
    findByCallId: jest.fn(),
    findByCustomer: jest.fn(),
    linkOutboundSummary: jest.fn().mockResolvedValue({ count: 0 }),
    list: jest.fn(),
  };
  const ai = { generateResponse: jest.fn() };
  const customers = { findByPhone: jest.fn(), resolveCustomer: jest.fn() };
  const redis = { isAvailable: false, cache: { get: jest.fn(), set: jest.fn(), del: jest.fn() } };
  const config = { get: jest.fn().mockReturnValue(0) };
  const timeline = { recordEvent: jest.fn() };
  const usage = { increment: jest.fn() };
  const analytics = { record: jest.fn() };
  const service = new CallSummaryService(
    repository as never,
    ai as never,
    customers as never,
    redis as never,
    config as never,
    timeline as never,
    usage as never,
    analytics as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("generates a structured summary from a completed transcript and links the customer", async () => {
    repository.transcriptContext.mockResolvedValue({
      id: "transcript-1",
      organizationId: "org-1",
      callId: "call-1",
      conversationId: "conversation-1",
      fullText: "[00:00:01] USER: I need a roof inspection Tuesday.",
      call: {
        id: "call-1",
        callerNumber: "+14165550100",
        calledNumber: "+14165550200",
        status: "COMPLETED",
        startedAt: new Date("2026-06-22T10:00:00Z"),
        endedAt: new Date("2026-06-22T10:03:00Z"),
        durationSeconds: 180,
        agent: { id: "agent-1", name: "Reception" },
      },
    });
    customers.findByPhone.mockResolvedValue({ id: "customer-1" });
    ai.generateResponse.mockResolvedValue({
      content: JSON.stringify({
        summary: "Customer requested a roof inspection for Tuesday.",
        intent: "Roof Inspection",
        sentiment: "POSITIVE",
        outcome: "BOOKED_APPOINTMENT",
        nextAction: "Technician visits Tuesday.",
        followUpRequired: true,
        confidenceScore: 0.94,
      }),
      model: "gpt-5.2",
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    repository.upsert.mockImplementation(async (input) => ({ id: "summary-1", ...input }));

    const result = await service.generateForTranscript({
      organizationId: "org-1",
      transcriptId: "transcript-1",
    });

    expect(result.id).toBe("summary-1");
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: "call-1",
        customerProfileId: "customer-1",
        summaryVersion: "call-summary-v1",
        model: "gpt-5.2",
        sentiment: "POSITIVE",
        outcome: "BOOKED_APPOINTMENT",
      }),
    );
    expect(timeline.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "AI_SUMMARY_GENERATED",
        customerProfileId: "customer-1",
        idempotencyKey: "ai-summary:call-1",
      }),
    );
    expect(repository.linkOutboundSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        callId: "call-1",
        summaryId: "summary-1",
        qualified: true,
        appointmentBooked: true,
      }),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "AI_SUMMARY_GENERATIONS" }),
    );
  });

  it("uses callId upsert semantics so retries update rather than duplicate", async () => {
    repository.transcriptContext.mockResolvedValue({
      id: "transcript-1",
      callId: "call-1",
      conversationId: null,
      fullText: "USER: Please send details.",
      call: {
        callerNumber: "+14165550100",
        calledNumber: "+14165550200",
        startedAt: new Date(),
        durationSeconds: 30,
        agent: { id: "agent-1", name: "Agent" },
      },
    });
    customers.findByPhone.mockResolvedValue({ id: "customer-1" });
    ai.generateResponse.mockResolvedValue({
      content: '{"summary":"Details requested.","intent":"Information","sentiment":"NEUTRAL","outcome":"INFORMATION_PROVIDED","nextAction":null,"followUpRequired":false,"confidenceScore":0.8}',
      model: "gpt-5.2",
      tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    });
    repository.upsert.mockResolvedValue({ id: "same-summary", callId: "call-1" });

    await service.generateForTranscript({ organizationId: "org-1", transcriptId: "transcript-1" });
    await service.generateForTranscript({ organizationId: "org-1", transcriptId: "transcript-1" });

    expect(repository.upsert).toHaveBeenCalledTimes(2);
    expect(repository.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ callId: "call-1" }),
    );
  });

  it("does not persist a summary when OpenAI fails", async () => {
    repository.transcriptContext.mockResolvedValue({
      id: "transcript-1",
      callId: "call-1",
      fullText: "USER: Hello",
      call: {
        callerNumber: "+14165550100",
        calledNumber: "+14165550200",
        startedAt: new Date(),
        durationSeconds: 10,
        agent: { id: "agent-1", name: "Agent" },
      },
    });
    customers.findByPhone.mockResolvedValue({ id: "customer-1" });
    ai.generateResponse.mockRejectedValue(new Error("OpenAI unavailable"));

    await expect(
      service.generateForTranscript({ organizationId: "org-1", transcriptId: "transcript-1" }),
    ).rejects.toThrow("OpenAI unavailable");
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("enforces tenant-scoped summary reads", async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.get({ organizationId: "org-1" } as never, "summary-other-tenant"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findById).toHaveBeenCalledWith("org-1", "summary-other-tenant");
  });
});
