import { RealtimeMetricsService } from "./realtime-metrics.service";

describe("RealtimeMetricsService", () => {
  it("exports p50, p95, and p99 distributions with success counts", () => {
    const service = new RealtimeMetricsService();
    const now = service.now();
    for (let index = 0; index < 100; index += 1) {
      service.observe("webhook_processing_ms", now);
    }

    expect(service.snapshot().distributions.webhook_processing_ms).toEqual(
      expect.objectContaining({
        count: 100,
        success: 100,
        failure: 0,
        p50: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
      }),
    );
  });
});
