import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { LatencyMetricsService } from "./latency-metrics.service";

describe("LatencyMetricsService", () => {
  it("marks latency gates from measured p95 values and leaves unsampled gates unknown", () => {
    const realtime = new RealtimeMetricsService();
    realtime.observeValue("webhook_processing_ms", 8);
    realtime.observeValue("webhook_processing_ms", 12);
    realtime.observeValue("db_lookup_ms", 15);
    const service = new LatencyMetricsService(realtime);

    const gates = service.gates();

    expect(gates.find((gate) => gate.key === "webhook")).toEqual(
      expect.objectContaining({ status: "PASS", p95: 12, targetMs: 20 }),
    );
    expect(gates.find((gate) => gate.key === "database")).toEqual(
      expect.objectContaining({ status: "FAIL", p95: 15, targetMs: 10 }),
    );
    expect(gates.find((gate) => gate.key === "redis")).toEqual(
      expect.objectContaining({ status: "UNKNOWN", sampleCount: 0 }),
    );
  });
});
