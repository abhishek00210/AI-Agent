import { Injectable } from "@nestjs/common";
import { PlatformVerificationService } from "./platform-verification.service";

@Injectable()
export class LaunchReadinessReportService {
  constructor(private readonly verification: PlatformVerificationService) {}

  run() { return this.verification.verify(); }

  async markdown() {
    const result = await this.run();
    const lines = [
      "# Launch Readiness Report",
      "",
      `Generated: ${result.generatedAt}`,
      `Environment: ${result.environment}`,
      `Recommendation: **${result.summary.recommendation}**`,
      "",
      "## Verification Results",
      "",
      "| Status | Area | Check | Evidence |",
      "| --- | --- | --- | --- |",
      ...result.checks.map((check) => `| ${check.status} | ${check.area} | ${escape(check.message)} | ${escape(JSON.stringify(check.evidence ?? {}))} |`),
      "",
      "## Performance Metrics",
      "",
      "| Query | Samples | p50 | p95 | p99 | Target p95 | Status |",
      "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
      ...result.performance.map((metric) => `| ${metric.name} | ${metric.samples} | ${metric.p50Ms} ms | ${metric.p95Ms} ms | ${metric.p99Ms} ms | ${metric.targetP95Ms} ms | ${metric.status} |`),
      "",
      "## Known Limitations",
      "",
      "- Provider-dependent Twilio and OpenAI paths require real calls for definitive production evidence; this report never places billable calls.",
      "- A WARN means implementation tests pass but sufficient production lifecycle evidence is not yet present.",
      "- Node.js 22 LTS upgrade remains scheduled maintenance for the VPS.",
      "",
      "## Deployment Risks",
      "",
      "- External provider latency and availability remain outside platform control.",
      "- Redis outages activate database/fallback paths and may reduce throughput.",
      "- Campaign calling intentionally remains serialized; predictive and parallel dialing are not launch scope.",
      "",
      "## Summary",
      "",
      `- Passed: ${result.summary.pass}`,
      `- Warnings: ${result.summary.warn}`,
      `- Failed: ${result.summary.fail}`,
      `- Launch recommendation: ${result.summary.recommendation}`,
      "",
    ];
    return lines.join("\n");
  }
}

function escape(value: string) { return value.replaceAll("|", "\\|").replaceAll("\n", " "); }
