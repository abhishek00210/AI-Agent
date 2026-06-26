import { AnalyticsAggregationService } from "./analytics-aggregation.service";

describe("AnalyticsAggregationService", () => {
  it("reconciles corrected transactional state and replaces stale agent attribution", async () => {
    const repository = createRepository({
      calls: [{ direction: "INBOUND", _count: { _all: 1 }, _sum: { durationSeconds: 120 } }],
      sessionDuration: [{ seconds: 180 }],
      appointments: [{ source: "VOICE", _count: { _all: 1 } }],
      leads: [{ source: "VOICE", status: "QUALIFIED", _count: { _all: 2 } }],
      sms: 3,
      usage: [{ resourceType: "AI_MINUTES", _sum: { quantity: 4 } }],
      revenue: [{ value: 49.5 }],
      agentCalls: [{ agentId: "agent-new", _count: { _all: 1 } }],
      agentAppointments: [{ agentId: "agent-new", _count: { _all: 1 } }],
      agentLeads: [{ agentId: "agent-new", _count: { _all: 2 } }],
      agents: [{ id: "agent-new", name: "New owner" }],
    });
    const service = new AnalyticsAggregationService(repository as never);

    await service.reconcileDay("org-a", new Date("2026-06-20T18:45:00.000Z"));

    expect(repository.upsertDaily).toHaveBeenCalledWith(
      "org-a",
      new Date("2026-06-20T00:00:00.000Z"),
      expect.objectContaining({
        totalCalls: 1,
        appointments: 1,
        leads: 2,
        conversionRate: 50,
        aiMinutes: 4,
        revenue: 49.5,
        callDurationSeconds: 180,
        avgCallDuration: 180,
      }),
    );
    expect(repository.replaceAgentDaily).toHaveBeenCalledWith("org-a", expect.any(Date), [
      {
        agentId: "agent-new",
        agentName: "New owner",
        calls: 1,
        appointments: 1,
        leads: 2,
      },
    ]);
    expect(repository.upsertAgentDaily).not.toHaveBeenCalled();
  });

  it("uses verified Stripe invoice amounts for proration revenue snapshots", async () => {
    const repository = createRepository({
      calls: [],
      sessionDuration: [{ seconds: 0 }],
      appointments: [],
      leads: [],
      sms: 0,
      usage: [],
      revenue: [{ value: 28.73 }],
      agentCalls: [],
      agentAppointments: [],
      agentLeads: [],
      agents: [],
    });
    const service = new AnalyticsAggregationService(repository as never);

    await service.reconcileDay("org-a", new Date("2026-06-20T00:00:00.000Z"));

    expect(repository.upsertDaily).toHaveBeenCalledWith(
      "org-a",
      expect.any(Date),
      expect.objectContaining({ revenue: 28.73 }),
    );
  });
});

function createRepository(fixtures: {
  calls: unknown[];
  sessionDuration: unknown[];
  appointments: unknown[];
  leads: unknown[];
  sms: number;
  usage: unknown[];
  revenue: unknown[];
  agentCalls: unknown[];
  agentAppointments: unknown[];
  agentLeads: unknown[];
  agents: unknown[];
}) {
  const call = {
    groupBy: jest
      .fn()
      .mockResolvedValueOnce(fixtures.calls)
      .mockResolvedValueOnce(fixtures.agentCalls),
  };
  const appointment = {
    groupBy: jest
      .fn()
      .mockResolvedValueOnce(fixtures.appointments)
      .mockResolvedValueOnce(fixtures.agentAppointments),
  };
  const lead = {
    groupBy: jest
      .fn()
      .mockResolvedValueOnce(fixtures.leads)
      .mockResolvedValueOnce(fixtures.agentLeads),
  };
  const communicationMessage = { count: jest.fn().mockResolvedValue(fixtures.sms) };
  const usageEvent = { groupBy: jest.fn().mockResolvedValue(fixtures.usage) };
  const agent = { findMany: jest.fn().mockResolvedValue(fixtures.agents) };
  const raw = jest
    .fn()
    .mockResolvedValueOnce(fixtures.sessionDuration)
    .mockResolvedValueOnce(fixtures.revenue);
  return {
    client: jest.fn(() => ({
      call,
      appointment,
      lead,
      communicationMessage,
      usageEvent,
      agent,
      $queryRaw: raw,
    })),
    upsertDaily: jest.fn(),
    upsertAgentDaily: jest.fn(),
    replaceAgentDaily: jest.fn(),
    audit: jest.fn(),
  };
}
