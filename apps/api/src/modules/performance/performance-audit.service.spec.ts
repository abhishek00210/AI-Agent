import { PerformanceAuditService } from "./performance-audit.service";

describe("PerformanceAuditService", () => {
  it("reports queue backlogs and partial launch state when latency samples are missing", async () => {
    const latency = {
      snapshot: jest.fn(() => ({
        distributions: {},
        counters: { routing_cache_hits: 9, routing_cache_misses: 1 },
        ratios: { routingCacheHit: 0.9, cacheHit: 0.75 },
        eventLoopLagMs: { p50: 1, p95: 2, p99: 3, max: 4 },
      })),
      gates: jest.fn(() => [
        {
          key: "webhook",
          label: "Webhook p95",
          targetMs: 20,
          metric: "webhook_processing_ms",
          status: "UNKNOWN",
          sampleCount: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        },
      ]),
    };
    const redis = {
      isAvailable: true,
      cache: {
        llen: jest.fn().mockResolvedValue(101),
        zcard: jest.fn().mockResolvedValue(0),
      },
      measure: jest.fn((_name: string, action: () => Promise<unknown>) => action()),
    };
    const service = new PerformanceAuditService(latency as never, redis as never);

    const report = await service.report();

    expect(report.launchRecommendation).toBe("FAIL");
    expect(report.cache.routingHitRate).toBe(0.9);
    expect(report.queues[0]).toEqual(
      expect.objectContaining({ status: "BACKLOG", waiting: 101 }),
    );
    expect(report.bottlenecks[0]).toContain("backlog");
  });
});
