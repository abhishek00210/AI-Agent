import { NotFoundException } from "@nestjs/common";
import { CustomerMemoryContextService } from "./customer-memory-context.service";
import { PromptMemoryBuilder } from "./prompt-memory.builder";

describe("CustomerMemoryContextService", () => {
  const prisma = {
    customerProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
    callSummary: { findMany: jest.fn() },
    customerTimelineEvent: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    auditEvent: { create: jest.fn().mockResolvedValue({ id: "audit-1" }), findMany: jest.fn() },
  };
  const redis = {
    isAvailable: false,
    cache: { get: jest.fn(), set: jest.fn(), incr: jest.fn() },
  };
  const usage = { increment: jest.fn().mockResolvedValue(undefined) };
  const analytics = { record: jest.fn().mockResolvedValue({ duplicate: false }) };
  const prompts = new PromptMemoryBuilder();
  const service = new CustomerMemoryContextService(
    prisma as never,
    redis as never,
    prompts,
    usage as never,
    analytics as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    redis.isAvailable = false;
    prisma.customerProfile.findFirst.mockResolvedValue({
      id: "customer-1",
      organizationId: "org-1",
      contactId: "contact-1",
      name: "John Smith",
      company: "ABC Roofing",
      leadStatus: "QUALIFIED",
      lastContactAt: new Date("2026-06-20T10:00:00Z"),
      totalCalls: 3,
    });
    prisma.callSummary.findMany
      .mockResolvedValueOnce([
        {
          id: "summary-1",
          summary: "Customer requested a roof inspection.",
          intent: "Roof inspection",
          sentiment: "POSITIVE",
          outcome: "BOOKED_APPOINTMENT",
          nextAction: "Provide quote.",
          followUpRequired: true,
          confidenceScore: 0.92,
          generatedAt: new Date("2026-06-20T10:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([
        { id: "summary-1", nextAction: "Provide quote.", generatedAt: new Date("2026-06-20T10:00:00Z") },
      ]);
    prisma.customerTimelineEvent.findMany.mockResolvedValue([
      {
        id: "event-1",
        eventType: "APPOINTMENT_BOOKED",
        title: "Appointment booked",
        description: "Roof inspection booked.",
        occurredAt: new Date("2026-06-20T10:05:00Z"),
        sourceEntityType: "Appointment",
        sourceEntityId: "appointment-1",
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        {
          id: "appointment-1",
          title: "Roof inspection",
          status: "CONFIRMED",
          startTime: new Date("2099-06-30T14:00:00Z"),
          endTime: new Date("2099-06-30T14:30:00Z"),
          timezone: "America/Toronto",
        },
      ])
      .mockResolvedValueOnce([]);
  });

  it("builds bounded returning-caller memory from summaries, timeline, and appointments", async () => {
    const result = await service.buildContext({
      organizationId: "org-1",
      customerProfileId: "customer-1",
      interactionId: "call-2",
      excludeCallId: "call-2",
      channel: "VOICE",
    });

    expect(result.recognized).toBe(true);
    expect(result.recentSummaries).toHaveLength(1);
    expect(result.recentTimeline).toHaveLength(1);
    expect(result.appointments).toHaveLength(1);
    expect(result.promptContext).toContain("John Smith");
    expect(result.promptContext.length).toBeLessThanOrEqual(6_000);
    expect(usage.increment).toHaveBeenCalledWith(expect.objectContaining({ resourceType: "MEMORY_RETRIEVALS" }));
    expect(analytics.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "CALLER_RECOGNIZED" }));
  });

  it("never selects transcript text for prompt memory", async () => {
    await service.getRecentSummaries("org-1", "customer-1", "call-2");
    const query = prisma.callSummary.findMany.mock.calls[0]?.[0];
    expect(query.select).not.toHaveProperty("transcript");
    expect(query.select).not.toHaveProperty("fullText");
    expect(query.take).toBe(5);
  });

  it("keeps an unknown first-time caller on the standard flow", async () => {
    prisma.customerProfile.findFirst.mockResolvedValueOnce({
      id: "customer-1",
      organizationId: "org-1",
      contactId: "contact-1",
      name: "+14165550100",
      company: null,
      leadStatus: "NEW",
      lastContactAt: new Date(),
      totalCalls: 1,
    });
    prisma.callSummary.findMany.mockReset().mockResolvedValue([]);
    prisma.customerTimelineEvent.findMany.mockResolvedValue([]);
    prisma.appointment.findMany.mockReset().mockResolvedValue([]);
    const result = await service.buildContext({
      organizationId: "org-1",
      customerProfileId: "customer-1",
      interactionId: "call-1",
      excludeCallId: "call-1",
      channel: "VOICE",
    });
    expect(result.recognized).toBe(false);
    expect(result.promptContext).toBe("");
    expect(prompts.personalizedGreeting(result)).toBeNull();
  });

  it("rejects a customer outside the tenant", async () => {
    prisma.customerProfile.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.buildContext({
        organizationId: "other-org",
        customerProfileId: "customer-1",
        interactionId: "call-x",
        channel: "VOICE",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customerProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "customer-1", organizationId: "other-org" } }),
    );
  });
});
