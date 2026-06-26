import { NotFoundException } from "@nestjs/common";
import { CommunicationService } from "./communication.service";

describe("CommunicationService", () => {
  const messages = {
    findThread: jest.fn(),
    findContact: jest.fn(),
    createContact: jest.fn(),
    create: jest.fn(),
    audit: jest.fn(),
    findAutomation: jest.fn(),
    list: jest.fn(),
    findScoped: jest.fn(),
  };
  const threads = { recordMessage: jest.fn() };
  const queue = { enqueue: jest.fn() };
  const redis = { isAvailable: false };
  const gates = { assertAvailable: jest.fn().mockResolvedValue(undefined) };
  const service = new CommunicationService(
    messages as never,
    threads as never,
    queue as never,
    redis as never,
    gates as never,
  );
  const context = {
    organizationId: "org-1",
    userId: "user-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it("creates a tenant thread, persists the message, and only queues provider delivery", async () => {
    messages.findContact.mockResolvedValue({ id: "contact-1" });
    threads.recordMessage.mockResolvedValue({ id: "thread-1", contactId: "contact-1" });
    messages.create.mockResolvedValue({ id: "message-1", status: "QUEUED", provider: "TWILIO" });

    const result = await service.send(context, { phone: "+14165550100", message: "Confirmed" });

    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", threadId: "thread-1" }),
    );
    expect(gates.assertAvailable).toHaveBeenCalledWith("org-1", "sms");
    expect(queue.enqueue).toHaveBeenCalledWith(
      "SendSMS",
      { organizationId: "org-1", messageId: "message-1" },
      0,
    );
    expect(result).toEqual(expect.objectContaining({ messageId: "message-1" }));
  });

  it("rejects a thread owned by another tenant", async () => {
    messages.findThread.mockResolvedValue(null);
    await expect(
      service.send(context, {
        phone: "+14165550100",
        message: "Hello",
        threadId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("queues confirmation and a delayed reminder once per appointment", async () => {
    messages.findAutomation.mockResolvedValue(null);
    const send = jest.spyOn(service, "send").mockResolvedValue({} as never);
    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await service.scheduleAppointmentMessages(context, {
      id: "appointment-1",
      confirmationNumber: "APT-1",
      startTime,
      timezone: "America/Toronto",
      contact: { name: "Customer", phone: "+14165550100" },
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ jobName: "ReminderSMS", delayMs: expect.any(Number) }),
    );
    send.mockRestore();
  });

  it("keeps concurrent sends isolated by message job ID", async () => {
    messages.findThread.mockResolvedValue(null);
    messages.findContact.mockResolvedValue({ id: "contact-1" });
    threads.recordMessage.mockResolvedValue({ id: "thread-1", contactId: "contact-1" });
    let sequence = 0;
    messages.create.mockImplementation(() =>
      Promise.resolve({ id: `message-${++sequence}`, status: "QUEUED", provider: "TWILIO" }),
    );

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        service.send(context, { phone: "+14165550100", message: `Message ${index}` }),
      ),
    );

    expect(queue.enqueue).toHaveBeenCalledTimes(20);
    expect(new Set(queue.enqueue.mock.calls.map((call) => call[1].messageId)).size).toBe(20);
  });
});
