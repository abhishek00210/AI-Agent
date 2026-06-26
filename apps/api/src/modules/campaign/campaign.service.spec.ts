import { CampaignService } from "./campaign.service";

describe("CampaignService", () => {
  const prisma = {
    agent: { findFirst: jest.fn() },
    customerProfile: { findFirst: jest.fn() },
    campaign: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    campaignTarget: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const targets = { resolve: jest.fn() };
  const gates = { assertCampaignTargetCapacity: jest.fn(), canReceiveCalls: jest.fn() };
  const outbound = { create: jest.fn(), cancel: jest.fn() };
  const usage = { increment: jest.fn() };
  const timeline = { recordEvent: jest.fn() };
  const analytics = { record: jest.fn() };
  const service = new CampaignService(
    prisma as never,
    targets as never,
    gates as never,
    outbound as never,
    usage as never,
    timeline as never,
    analytics as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
    prisma.auditEvent.create.mockResolvedValue({});
    usage.increment.mockResolvedValue({});
    timeline.recordEvent.mockResolvedValue({});
    analytics.record.mockResolvedValue({});
    gates.canReceiveCalls.mockResolvedValue(true);
    prisma.campaignTarget.findFirst.mockResolvedValue(null);
  });

  it("creates a tenant-scoped draft with unique resolved targets and enforces plan capacity", async () => {
    prisma.agent.findFirst.mockResolvedValue({ id: "agent-1" });
    targets.resolve.mockResolvedValue([
      { customerProfileId: "customer-1", leadId: "lead-1" },
      { customerProfileId: "customer-2", leadId: null },
    ]);
    prisma.campaign.create.mockResolvedValue(campaign());

    const result = await service.create({ organizationId: "org-1" } as never, {
      name: "Lead follow-up",
      campaignType: "FOLLOW_UP" as never,
      assignedAgentId: "agent-1",
      scheduleType: "IMMEDIATE" as never,
      customerProfileIds: ["customer-1", "customer-2"],
    });

    expect(gates.assertCampaignTargetCapacity).toHaveBeenCalledWith("org-1", 2);
    expect(prisma.campaign.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        targetCount: 2,
        targets: { createMany: { data: expect.any(Array), skipDuplicates: true } },
      }),
    }));
    expect(usage.increment).toHaveBeenCalledWith(expect.objectContaining({ resourceType: "CAMPAIGN_TARGETS", quantity: 2 }));
    expect(result.metrics.targets).toBe(2);
  });

  it("never dispatches a paused campaign", async () => {
    prisma.campaignTarget.findMany.mockResolvedValue([]);
    prisma.campaignTarget.count.mockResolvedValue(1);
    prisma.campaign.findFirst.mockResolvedValue(campaign({ status: "PAUSED" }));

    const result = await service.dispatchNext("org-1", "campaign-1");

    expect(result).toEqual({ dispatched: false, reason: "PAUSED" });
    expect(outbound.create).not.toHaveBeenCalled();
  });

  it("claims exactly one target and delegates dialing to OutboundCallService", async () => {
    prisma.campaignTarget.findMany.mockResolvedValue([]);
    prisma.campaignTarget.count.mockResolvedValue(1);
    prisma.campaign.findFirst.mockResolvedValue(campaign());
    prisma.campaignTarget.updateMany.mockResolvedValue({ count: 1 });
    prisma.campaignTarget.update.mockResolvedValue({});
    prisma.campaign.update.mockResolvedValue(campaign({ callsCreated: 1 }));
    outbound.create.mockResolvedValue({ id: "outbound-1" });

    const result = await service.dispatchNext("org-1", "campaign-1");

    expect(outbound.create).toHaveBeenCalledTimes(1);
    expect(outbound.create).toHaveBeenCalledWith(
      { organizationId: "org-1" },
      expect.objectContaining({ source: "CAMPAIGN", campaignTargetId: "target-1" }),
    );
    expect(result).toEqual({ dispatched: true, targetId: "target-1", outboundCallId: "outbound-1" });
  });

  it("cancels pending targets without crossing tenant boundaries", async () => {
    prisma.campaign.findFirst.mockResolvedValue(campaign());
    prisma.campaignTarget.updateMany.mockResolvedValue({ count: 1 });
    prisma.campaign.update.mockResolvedValue(campaign({ status: "CANCELLED" }));

    const result = await service.cancel({ organizationId: "org-1" }, "campaign-1");

    expect(prisma.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "campaign-1", organizationId: "org-1" } }));
    expect(result.status).toBe("CANCELLED");
  });
});

function campaign(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-24T12:00:00.000Z");
  return {
    id: "campaign-1",
    organizationId: "org-1",
    name: "Lead follow-up",
    description: null,
    campaignType: "FOLLOW_UP",
    status: "RUNNING",
    assignedAgentId: "agent-1",
    scheduleType: "IMMEDIATE",
    scheduledAt: null,
    recurrence: null,
    targetingFilters: {},
    maxAttempts: 1,
    targetCount: 2,
    callsCreated: 0,
    callsCompleted: 0,
    connectedCalls: 0,
    qualifiedLeads: 0,
    appointmentsBooked: 0,
    startedAt: now,
    completedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    assignedAgent: { id: "agent-1", name: "Sales", status: "ACTIVE" },
    targets: [
      {
        id: "target-1",
        campaignId: "campaign-1",
        customerProfileId: "customer-1",
        leadId: "lead-1",
        outboundCallId: null,
        status: "PENDING",
        attemptCount: 0,
        lastAttemptAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        customerProfile: { id: "customer-1", name: "Jane", phone: "+14165550100", leadStatus: "NEW" },
        lead: { id: "lead-1", status: "NEW" },
        outboundCall: null,
      },
    ],
    ...overrides,
  };
}
