import { AppointmentService, createAppointmentIdempotencyKey } from "./appointment.service";

describe("AppointmentService", () => {
  const context = {
    userId: "user-1",
    organizationId: "org-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  it("books through an injected provider without depending on LocalAppointmentProvider", async () => {
    const provider = {
      name: "google",
      book: jest.fn().mockResolvedValue(appointment({ confirmationNumber: "APT-2026-004238" })),
    };
    const service = new AppointmentService(
      { createAuditEvent: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      provider,
      {
        contact: {
          findFirst: jest.fn().mockResolvedValue({ id: "contact-1" }),
          update: jest.fn().mockResolvedValue({ id: "contact-1" }),
          create: jest.fn(),
        },
      } as never,
      { scheduleAppointmentMessages: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const result = await service.bookFromTool(context, {
      agentId: "agent-1",
      source: "VOICE",
      customerName: "Jane Customer",
      phone: "+14155551234",
      email: "jane@example.com",
      preferredDate: "2026-07-01",
      preferredTime: "14:00",
      timezone: "America/Toronto",
    });

    expect(provider.book).toHaveBeenCalledTimes(1);
    expect(result.appointment.confirmationNumber).toBe("APT-2026-004238");
  });

  it("creates stable idempotency keys for equivalent OpenAI retries", () => {
    const first = createAppointmentIdempotencyKey({
      agentId: "agent-1",
      phone: "+14155551234",
      email: "jane@example.com",
      preferredDate: "2026-07-01",
      preferredTime: "14:00",
      timezone: "America/Toronto",
    });
    const second = createAppointmentIdempotencyKey({
      timezone: "America/Toronto",
      preferredTime: "14:00",
      preferredDate: "2026-07-01",
      email: "jane@example.com",
      phone: "+14155551234",
      agentId: "agent-1",
    });

    expect(second).toBe(first);
  });
});

function appointment(input: { confirmationNumber: string }) {
  return {
    id: "appointment-1",
    organizationId: "org-1",
    agentId: "agent-1",
    contactId: "contact-1",
    conversationId: null,
    callId: null,
    title: "Appointment with Jane Customer",
    description: null,
    status: "CONFIRMED",
    timezone: "America/Toronto",
    startTime: new Date("2026-07-01T18:00:00.000Z"),
    endTime: new Date("2026-07-01T18:30:00.000Z"),
    source: "VOICE",
    confirmationNumber: input.confirmationNumber,
    idempotencyKey: "key-1",
    notes: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
