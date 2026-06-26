import { AutomationActionService } from "./automation-action.service";

describe("AutomationActionService", () => {
  const prisma = { emailQueue: { create: jest.fn() } };
  const communications = { send: jest.fn() };
  const timeline = { recordEvent: jest.fn() };
  const usage = { increment: jest.fn() };
  const service = new AutomationActionService(
    prisma as never,
    communications as never,
    timeline as never,
    usage as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("queues SMS through CommunicationService and preserves the follow-up reason", async () => {
    communications.send.mockResolvedValue({
      messageId: "message-1",
      threadId: "thread-1",
      status: "QUEUED",
    });
    const result = await service.execute(execution("SMS") as never);
    expect(result).toEqual(expect.objectContaining({ communicationMessageId: "message-1" }));
    expect(communications.send).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-a" }),
      expect.objectContaining({
        phone: "+14165550100",
        metadata: expect.objectContaining({
          reasonType: "MISSED_APPOINTMENT",
          reasonDescription: "Customer missed appointment.",
          followUpReason: "Customer missed appointment.",
        }),
      }),
    );
  });

  it("creates a queue-ready email when an email provider worker is unavailable", async () => {
    prisma.emailQueue.create.mockResolvedValue({ id: "email-1", status: "PENDING" });
    await expect(service.execute(execution("EMAIL") as never)).resolves.toEqual({
      emailQueueId: "email-1",
      dispatchStatus: "PENDING",
    });
  });

  it("creates a future outbound-call task with an explicit reason", async () => {
    const result = await service.execute(execution("CALL") as never);
    expect(result).toEqual(
      expect.objectContaining({
        outboundCallTask: expect.objectContaining({
          reasonType: "MISSED_APPOINTMENT",
          reasonDescription: "Customer missed appointment.",
          reason: "Customer missed appointment.",
          status: "QUEUED_FOR_OUTBOUND_CALL_ENGINE",
          nextEngineContract: expect.objectContaining({
            humanPickup: "START_AI_CONVERSATION",
            voicemail: "LEAVE_SHORT_MESSAGE_OR_HANG_UP_PER_TENANT_SETTINGS",
            busy: "APPLY_RETRY_POLICY",
            noAnswer: "RECORD_TIMELINE_AND_UPDATE_WORKFLOW",
            summary: "USE_TRANSCRIPT_SUMMARY_TIMELINE_PIPELINE",
          }),
        }),
      }),
    );
  });
});

function execution(actionType: "SMS" | "EMAIL" | "CALL") {
  return {
    id: "execution-1",
    organizationId: "org-a",
    customerProfileId: "customer-1",
    workflowId: "workflow-1",
    actionType,
    reasonType: "MISSED_APPOINTMENT",
    reasonDescription: "Customer missed appointment.",
    followUpReason: "Customer missed appointment.",
    rule: {
      template: {
        body: "Hi {{firstName}}, {{followUpReason}}",
        subject: "Follow-up for {{customerName}}",
      },
    },
    customerProfile: { name: "John Smith", phone: "+14165550100", email: "john@example.com" },
  };
}
