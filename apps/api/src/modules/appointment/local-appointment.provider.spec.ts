import { BadRequestException } from "@nestjs/common";
import { LocalAppointmentProvider } from "./local-appointment.provider";

describe("LocalAppointmentProvider", () => {
  const context = {
    userId: "user-1",
    organizationId: "org-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  it("maps database overlap conflicts to a safe booking error", async () => {
    const provider = new LocalAppointmentProvider(
      {
        createTransactional: jest.fn().mockRejectedValue({ code: "P2004" }),
      } as never,
      {
        validate: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        generate: jest.fn().mockReturnValue("APT-2026-004238"),
      } as never,
    );

    await expect(
      provider.book(context, {
        agentId: "agent-1",
        title: "Appointment",
        status: "CONFIRMED",
        timezone: "America/Toronto",
        preferredDate: "2026-07-01",
        preferredTime: "14:00",
        durationMinutes: 30,
        source: "VOICE",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns the existing appointment for idempotent OpenAI retries", async () => {
    const existing = appointment({ confirmationNumber: "APT-2026-004238" });
    const createTransactional = jest.fn();
    const provider = new LocalAppointmentProvider(
      {
        findByIdempotencyKey: jest.fn().mockResolvedValue(existing),
        createTransactional,
      } as never,
      {
        validate: jest.fn(),
      } as never,
      {
        generate: jest.fn().mockReturnValue("APT-2026-004239"),
      } as never,
    );

    const result = await provider.book(context, {
      agentId: "agent-1",
      title: "Appointment",
      status: "CONFIRMED",
      timezone: "America/Toronto",
      preferredDate: "2026-07-01",
      preferredTime: "14:00",
      durationMinutes: 30,
      source: "VOICE",
      idempotencyKey: "stable-key",
    });

    expect(result.confirmationNumber).toBe("APT-2026-004238");
    expect(createTransactional).not.toHaveBeenCalled();
  });
});

function appointment(input: { confirmationNumber: string }) {
  return {
    id: "appointment-1",
    organizationId: "org-1",
    agentId: "agent-1",
    contactId: null,
    conversationId: null,
    callId: null,
    title: "Appointment",
    description: null,
    status: "CONFIRMED",
    timezone: "America/Toronto",
    startTime: new Date("2026-07-01T18:00:00.000Z"),
    endTime: new Date("2026-07-01T18:30:00.000Z"),
    source: "VOICE",
    confirmationNumber: input.confirmationNumber,
    idempotencyKey: "stable-key",
    notes: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
