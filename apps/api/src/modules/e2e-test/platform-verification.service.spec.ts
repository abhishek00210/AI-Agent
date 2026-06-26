import { PlatformVerificationService } from "./platform-verification.service";

describe("PlatformVerificationService", () => {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ count: 0n }]),
    call: { findFirst: jest.fn().mockResolvedValue(null) },
    outboundCall: { findFirst: jest.fn().mockResolvedValue(null) },
    automationExecution: { findFirst: jest.fn().mockResolvedValue(null) },
    analyticsEvent: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    campaign: { findFirst: jest.fn().mockResolvedValue(null) },
    phoneNumber: { count: jest.fn().mockResolvedValue(0) },
    externalPhoneNumber: { count: jest.fn().mockResolvedValue(0) },
    portRequest: { count: jest.fn().mockResolvedValue(0) },
    organization: { count: jest.fn().mockResolvedValue(1) },
    analyticsDailyMetric: { findMany: jest.fn().mockResolvedValue([]) },
    customerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    customerTimelineEvent: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const redis = { cache: { ping: jest.fn().mockResolvedValue("PONG") } };
  const memory = {
    memoryPolicy: jest.fn().mockReturnValue({
      recentSummaries: 5,
      recentTimelineEvents: 10,
      recentAppointments: 3,
      rawTranscriptsInjected: false,
    }),
  };

  beforeEach(() => jest.clearAllMocks());

  it("returns warnings instead of fabricated passes when provider lifecycle evidence is absent", async () => {
    const service = new PlatformVerificationService(prisma as never, redis as never, memory as never);
    const result = await service.verify();

    expect(result.checks.find((check) => check.id === "inbound_lifecycle")?.status).toBe("WARN");
    expect(result.checks.find((check) => check.id === "outbound_lifecycle")?.status).toBe("WARN");
    expect(result.checks.find((check) => check.id === "memory_policy")?.status).toBe("PASS");
    expect(result.performance).toHaveLength(4);
    expect(result.performance.every((metric) => metric.samples === 100)).toBe(true);
    expect(result.summary.recommendation).toBe("CONDITIONAL_GO");
  });

  it("marks raw transcript memory injection as a launch blocker", async () => {
    memory.memoryPolicy.mockReturnValueOnce({
      recentSummaries: 5,
      recentTimelineEvents: 10,
      recentAppointments: 3,
      rawTranscriptsInjected: true,
    });
    const service = new PlatformVerificationService(prisma as never, redis as never, memory as never);
    const result = await service.verify();

    expect(result.checks.find((check) => check.id === "memory_policy")?.status).toBe("FAIL");
    expect(result.summary.recommendation).toBe("NO_GO");
  });
});
