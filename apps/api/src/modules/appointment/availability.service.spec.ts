import { AvailabilityService } from "./availability.service";

describe("AvailabilityService", () => {
  const context = {
    userId: "user-1",
    organizationId: "org-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  it("makes cancelled appointment slots available without rebuilding availability", async () => {
    const service = new AvailabilityService({
      availability: {
        findMany: jest.fn().mockResolvedValue([
          rule({ bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }),
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as never);

    const slots = await service.slots(context, {
      date: "2026-07-01",
      agentId: "agent-1",
      durationMinutes: 30,
    });

    expect(slots.some((slot) => slot.startTime.toISOString() === "2026-07-01T14:00:00.000Z")).toBe(
      true,
    );
  });

  it("applies buffers around existing appointments when generating dynamic slots", async () => {
    const service = new AvailabilityService({
      availability: {
        findMany: jest.fn().mockResolvedValue([
          rule({ bufferBeforeMinutes: 15, bufferAfterMinutes: 15 }),
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            startTime: new Date("2026-07-01T14:00:00.000Z"),
            endTime: new Date("2026-07-01T14:30:00.000Z"),
          },
        ]),
      },
    } as never);

    const slots = await service.slots(context, {
      date: "2026-07-01",
      agentId: "agent-1",
      durationMinutes: 30,
    });

    expect(slots.some((slot) => slot.startTime.toISOString() === "2026-07-01T14:30:00.000Z")).toBe(
      false,
    );
    expect(slots.some((slot) => slot.startTime.toISOString() === "2026-07-01T14:45:00.000Z")).toBe(
      true,
    );
  });
});

function rule(input: { bufferBeforeMinutes: number; bufferAfterMinutes: number }) {
  return {
    id: "availability-1",
    organizationId: "org-1",
    dayOfWeek: 3,
    startTime: "09:00",
    endTime: "17:00",
    isEnabled: true,
    timezone: "America/Toronto",
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
