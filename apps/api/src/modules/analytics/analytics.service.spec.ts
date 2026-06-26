import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  const repository = {
    daily: jest.fn(),
    topAgents: jest.fn(),
    recentActivity: jest.fn(),
    snapshots: jest.fn(),
    createEvent: jest.fn(),
    applyEvent: jest.fn(),
    audit: jest.fn(),
  };
  const redis = {
    isAvailable: false,
    cache: { get: jest.fn(), set: jest.fn(), keys: jest.fn(), del: jest.fn() },
  };
  const service = new AnalyticsService(repository as never, redis as never);
  beforeEach(() => jest.clearAllMocks());

  it("calculates weighted duration and conversion from daily snapshots", async () => {
    repository.daily.mockResolvedValue([
      row({ totalCalls: 2, incomingCalls: 2, leads: 4, appointments: 1, callDurationSeconds: 120 }),
      row({ totalCalls: 1, outgoingCalls: 1, leads: 1, appointments: 1, callDurationSeconds: 180 }),
    ]);
    repository.topAgents.mockResolvedValue([]);
    repository.recentActivity.mockResolvedValue([]);
    repository.snapshots.mockResolvedValue([]);
    const result = await service.dashboard("org-a", {
      from: new Date("2026-06-01"),
      to: new Date("2026-06-03"),
    });
    expect(result.overview.totalCalls).toBe(3);
    expect(result.overview.conversionRate).toBe(40);
    expect(result.overview.averageCallDuration).toBe(100);
    expect(result.definitions.conversionRate).toContain("appointments / leads");
    expect(result.definitions.revenue).toContain("invoice.payment_succeeded");
    expect(repository.daily).toHaveBeenCalledWith("org-a", expect.any(Object));
  });

  it("deduplicates analytics events before aggregation", async () => {
    repository.createEvent.mockResolvedValue(null);
    await expect(
      service.record({
        organizationId: "org-a",
        eventType: "LEAD_CREATED",
        idempotencyKey: "lead:1",
      }),
    ).resolves.toEqual({ duplicate: true });
    expect(repository.applyEvent).not.toHaveBeenCalled();
  });

  it("rejects custom ranges over 366 days", () => {
    expect(() =>
      service.resolveRange({ range: "CUSTOM", from: "2024-01-01", to: "2026-01-01" }),
    ).toThrow("between 1 and 366 days");
  });
});

function row(overrides: Record<string, number>) {
  return {
    date: new Date("2026-06-01"),
    totalCalls: 0,
    incomingCalls: 0,
    outgoingCalls: 0,
    appointments: 0,
    leads: 0,
    qualifiedLeads: 0,
    aiMinutes: 0,
    smsSent: 0,
    messagesSent: 0,
    revenue: 0,
    callDurationSeconds: 0,
    aiResponses: 0,
    aiInputTokens: 0n,
    aiOutputTokens: 0n,
    toolExecutions: 0,
    appointmentsBookedByAi: 0,
    leadsCreatedByAi: 0,
    newCustomers: 0,
    returningCustomers: 0,
    repeatCallers: 0,
    ...overrides,
  };
}
