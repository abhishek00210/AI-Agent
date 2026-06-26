import { MessageDeliveryService } from "./message-delivery.service";

describe("MessageDeliveryService", () => {
  it("maps the provider SID and delivery state after Twilio accepts a queued message", async () => {
    const messages = {
      findScoped: jest.fn().mockResolvedValue({
        id: "message-1",
        status: "QUEUED",
        phone: "+14165550100",
        body: "Hello",
      }),
      sendingNumber: jest.fn().mockResolvedValue({ phoneNumber: "+14165550999" }),
      markSending: jest.fn(),
      markSent: jest.fn().mockResolvedValue({ id: "message-1", status: "SENT" }),
      markFailed: jest.fn(),
      audit: jest.fn(),
    };
    const provider = {
      send: jest.fn().mockResolvedValue({ provider: "TWILIO", providerMessageId: "SM123" }),
    };
    const service = new MessageDeliveryService(
      messages as never,
      { getOrThrow: jest.fn().mockReturnValue("https://agent.example.com") } as never,
      provider as never,
    );

    await service.deliver("org-1", "message-1");

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+14165550100", from: "+14165550999" }),
    );
    expect(messages.markSent).toHaveBeenCalledWith("org-1", "message-1", "SM123", "TWILIO");
  });

  it("records FOLLOW_UP_SENT only after Twilio accepts an automated SMS", async () => {
    const messages = {
      findScoped: jest.fn().mockResolvedValue({
        id: "message-1",
        status: "QUEUED",
        phone: "+14165550100",
        body: "Follow up",
        metadata: {
          automationExecutionId: "execution-1",
          followUpReason: "Customer missed appointment.",
        },
        thread: { contactId: "contact-1" },
      }),
      sendingNumber: jest.fn().mockResolvedValue({ phoneNumber: "+14165550999" }),
      markSending: jest.fn(),
      markSent: jest.fn().mockResolvedValue({ id: "message-1", status: "SENT" }),
      markFailed: jest.fn(),
      audit: jest.fn(),
    };
    const timeline = { recordEvent: jest.fn() };
    const usage = { increment: jest.fn() };
    const service = new MessageDeliveryService(
      messages as never,
      { getOrThrow: jest.fn().mockReturnValue("https://agent.example.com") } as never,
      {
        send: jest.fn().mockResolvedValue({ provider: "TWILIO", providerMessageId: "SM123" }),
      } as never,
      usage as never,
      undefined,
      timeline as never,
    );
    await service.deliver("org-1", "message-1");
    expect(timeline.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "FOLLOW_UP_SENT",
        sourceEntityId: "execution-1",
        description: "Customer missed appointment.",
      }),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "AUTOMATION_SMS_SENT",
        idempotencyKey: "automation:sms:execution-1",
      }),
    );
  });
});
