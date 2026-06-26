import { NotFoundException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CustomerTimelineService } from "./customer-timeline.service";
import { TimelineEventFactory } from "./timeline-event.factory";

describe("CustomerTimelineService", () => {
  const prisma = {
    customerProfile: { findFirst: jest.fn() },
    customerTimelineEvent: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    auditEvent: { create: jest.fn() },
  };
  const redis = { isAvailable: false, cache: { get: jest.fn(), set: jest.fn(), incr: jest.fn() } };
  const usage = { increment: jest.fn() };
  const service = new CustomerTimelineService(
    prisma as never,
    redis as never,
    new TimelineEventFactory(),
    usage as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("records one idempotent timeline event for the tenant customer", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.customerTimelineEvent.create.mockResolvedValue({
      id: "event-1",
      eventType: "CALL_RECEIVED",
      occurredAt: new Date("2026-06-22T10:00:00Z"),
    });

    const result = await service.recordEvent({
      organizationId: "org-1",
      customerProfileId: "customer-1",
      eventType: "CALL_RECEIVED",
      sourceEntityType: "Call",
      sourceEntityId: "call-1",
      idempotencyKey: "call:received:call-1",
    });

    expect(result?.id).toBe("event-1");
    expect(prisma.customerTimelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          customerProfileId: "customer-1",
          eventCategory: "VOICE",
          idempotencyKey: "call:received:call-1",
        }),
      }),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", resourceType: "TIMELINE_WRITES" }),
    );
  });

  it("does not double-audit duplicate idempotency keys", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { code: "P2002" });
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.customerTimelineEvent.create.mockRejectedValue(duplicate);
    prisma.customerTimelineEvent.findUniqueOrThrow.mockResolvedValue({
      id: "event-existing",
      eventType: "CALL_RECEIVED",
    });

    await service.recordEvent({
      organizationId: "org-1",
      customerProfileId: "customer-1",
      eventType: "CALL_RECEIVED",
      idempotencyKey: "call:received:call-1",
    });

    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    expect(usage.increment).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant timeline reads", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue(null);

    await expect(service.getTimelinePage("org-1", "customer-2", {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.customerTimelineEvent.findMany).not.toHaveBeenCalled();
  });

  it("returns newest-first pages with cursor support", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.customerTimelineEvent.findMany.mockResolvedValue([
      { id: "event-2", occurredAt: new Date("2026-06-22T11:00:00Z") },
      { id: "event-1", occurredAt: new Date("2026-06-22T10:00:00Z") },
    ]);

    const page = await service.getTimelinePage("org-1", "customer-1", { limit: 1 });

    expect(page.data).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(prisma.customerTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-1", customerProfileId: "customer-1" }),
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 2,
      }),
    );
  });

  it("orders appointment lifecycle events by occurredAt rather than createdAt", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.customerTimelineEvent.findMany.mockResolvedValue([
      {
        id: "cancelled",
        eventType: "APPOINTMENT_CANCELLED",
        occurredAt: new Date("2026-06-22T12:00:00Z"),
        createdAt: new Date("2026-06-22T15:00:00Z"),
      },
      {
        id: "rescheduled",
        eventType: "APPOINTMENT_RESCHEDULED",
        occurredAt: new Date("2026-06-22T11:00:00Z"),
        createdAt: new Date("2026-06-22T16:00:00Z"),
      },
      {
        id: "booked",
        eventType: "APPOINTMENT_BOOKED",
        occurredAt: new Date("2026-06-22T10:00:00Z"),
        createdAt: new Date("2026-06-22T17:00:00Z"),
      },
    ]);

    const page = await service.getTimelinePage("org-1", "customer-1", { limit: 10 });

    expect(page.data.map((event: { eventType: string }) => event.eventType)).toEqual([
      "APPOINTMENT_CANCELLED",
      "APPOINTMENT_RESCHEDULED",
      "APPOINTMENT_BOOKED",
    ]);
    expect(prisma.customerTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ occurredAt: "desc" }, { id: "desc" }] }),
    );
  });

  it("uses keyset cursor pagination without offset skip for large timelines", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.customerTimelineEvent.findMany.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({
        id: `event-${index}`,
        occurredAt: new Date(`2026-06-22T10:${String(index % 60).padStart(2, "0")}:00Z`),
      })),
    );

    await service.getTimelinePage("org-1", "customer-1", { limit: 100 });

    expect(prisma.customerTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ skip: expect.any(Number) }),
    );
    expect(prisma.customerTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    );
  });

  it("keeps timeline source links append-only without foreign keys to deletable business records", () => {
    const schema = readFileSync(join(process.cwd(), "../../prisma/schema.prisma"), "utf8");
    const model = schema.match(/model CustomerTimelineEvent \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(model).toContain("sourceEntityType");
    expect(model).toContain("sourceEntityId");
    expect(model).not.toContain("lead        ");
    expect(model).not.toContain("appointment ");
    expect(model).not.toContain("communicationMessage");
  });
});
