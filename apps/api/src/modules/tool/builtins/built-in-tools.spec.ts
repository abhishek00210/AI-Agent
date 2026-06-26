import { BuiltInToolsFactory } from "./built-in-tools";

describe("BuiltInToolsFactory", () => {
  it("creates a voice lead after a successful appointment booking", async () => {
    const appointments = {
      bookFromTool: jest.fn().mockResolvedValue({
        message: "Appointment booked.",
        appointment: {
          id: "appointment-1",
          confirmationNumber: "APT-123",
          startTime: new Date("2026-07-01T18:00:00.000Z"),
          endTime: new Date("2026-07-01T18:30:00.000Z"),
          timezone: "America/Toronto",
          status: "CONFIRMED",
        },
      }),
    };
    const leads = {
      capture: jest.fn().mockResolvedValue({
        contact: { id: "contact-1" },
        lead: { id: "lead-1" },
      }),
    };
    const factory = new BuiltInToolsFactory(
      {} as never,
      appointments as never,
      leads as never,
      { send: jest.fn() } as never,
    );
    const booking = factory.tools().find((tool) => tool.name === "book_appointment");

    const result = await booking!.execute(
      {
        customerName: "Customer",
        phone: "+14155550100",
        email: "customer@example.com",
        preferredDate: "2026-07-01",
        preferredTime: "14:00",
        timezone: "America/Toronto",
      },
      {
        tenant: {
          organizationId: "org-1",
          userId: "public-voice-call",
          email: "voice-call@system.local",
          role: "MEMBER",
        },
        organizationId: "org-1",
        agentId: "agent-1",
        conversationId: "conversation-1",
        callId: "call-1",
        source: "VOICE",
      },
    );

    expect(leads.capture).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      expect.objectContaining({
        name: "Customer",
        phone: "+14155550100",
        source: "VOICE",
      }),
    );
    expect(result.data).toEqual(expect.objectContaining({ leadId: "lead-1" }));
  });
});
