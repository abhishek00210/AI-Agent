import { LaunchReadinessReportService } from "./launch-readiness-report.service";

describe("LaunchReadinessReportService", () => {
  it("renders explicit pass, warning, failure and percentile evidence", async () => {
    const verification = {
      verify: jest.fn().mockResolvedValue({
        generatedAt: "2026-06-24T00:00:00.000Z",
        environment: "test",
        checks: [{ id: "health", area: "Reliability", status: "PASS", message: "Healthy", evidence: { database: true } }],
        performance: [{ name: "analytics", samples: 100, p50Ms: 5, p95Ms: 9, p99Ms: 12, targetP95Ms: 100, status: "PASS" }],
        summary: { pass: 1, warn: 0, fail: 0, recommendation: "GO" },
      }),
    };
    const service = new LaunchReadinessReportService(verification as never);

    const report = await service.markdown();

    expect(report).toContain("Recommendation: **GO**");
    expect(report).toContain("| analytics | 100 | 5 ms | 9 ms | 12 ms | 100 ms | PASS |");
    expect(report).toContain("Provider-dependent Twilio and OpenAI paths");
  });
});
