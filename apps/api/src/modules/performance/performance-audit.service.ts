import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
import { LatencyMetricsService } from "./latency-metrics.service";
import type {
  PerformanceAuditReport,
  PerformanceGateResult,
  QueuePerformanceSummary,
} from "./performance.types";

const QUEUES = [
  "analytics-aggregation",
  "call-summary-generation",
  "central-usage",
  "embedding",
  "follow-up-automations",
  "outbound-campaigns",
  "recording-finalization",
  "sms-communications",
  "stripe-billing",
  "transcription",
  "website-scraper",
];

@Injectable()
export class PerformanceAuditService {
  constructor(
    private readonly latency: LatencyMetricsService,
    private readonly redis: RedisService,
  ) {}

  async report(): Promise<PerformanceAuditReport> {
    const snapshot = this.latency.snapshot();
    const gates = this.latency.gates();
    const queues = await this.queueSummaries();
    const bottleneckList = bottlenecks(gates, queues);
    return {
      generatedAt: new Date().toISOString(),
      launchRecommendation: recommendation(gates, queues),
      gates,
      cache: {
        routingHitRate: snapshot.ratios.routingCacheHit ?? 0,
        globalHitRate: snapshot.ratios.cacheHit ?? 0,
        counters: cacheCounters(snapshot.counters),
      },
      eventLoopLagMs: snapshot.eventLoopLagMs,
      queues,
      bottlenecks: bottleneckList,
      knownLimitations: [
        "OpenAI first-audio latency includes provider and network variance outside platform control.",
        "Latency gates require production call samples; UNKNOWN means no safe percentile claim yet.",
        "RAG latency applies only to knowledge/tool turns and must be reported separately from normal voice turns.",
      ],
    };
  }

  async markdown(): Promise<string> {
    const report = await this.report();
    const gateRows = report.gates
      .map(
        (gate) =>
          `| ${gate.label} | ${gate.metric} | ${gate.targetMs} | ${gate.sampleCount} | ${gate.p50} | ${gate.p95} | ${gate.p99} | ${gate.status} |`,
      )
      .join("\n");
    const queueRows = report.queues
      .map(
        (queue) =>
          `| ${queue.name} | ${queue.waiting} | ${queue.delayed} | ${queue.failed} | ${queue.status} |`,
      )
      .join("\n");
    return [
      "# Day 58 Performance Audit",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      `Launch recommendation: **${report.launchRecommendation}**`,
      "",
      "## Latency Gates",
      "",
      "| Gate | Metric | Target ms | Samples | p50 | p95 | p99 | Status |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
      gateRows || "| No samples | — | — | 0 | 0 | 0 | 0 | UNKNOWN |",
      "",
      "## Cache",
      "",
      `- Routing cache hit rate: ${report.cache.routingHitRate}`,
      `- Global cache hit rate: ${report.cache.globalHitRate}`,
      "",
      "## Event Loop",
      "",
      `- p50: ${report.eventLoopLagMs.p50} ms`,
      `- p95: ${report.eventLoopLagMs.p95} ms`,
      `- p99: ${report.eventLoopLagMs.p99} ms`,
      `- max: ${report.eventLoopLagMs.max} ms`,
      "",
      "## Queues",
      "",
      "| Queue | Waiting | Delayed | Failed | Status |",
      "| --- | ---: | ---: | ---: | --- |",
      queueRows || "| Redis unavailable | 0 | 0 | 0 | UNKNOWN |",
      "",
      "## Bottlenecks",
      "",
      ...(report.bottlenecks.length
        ? report.bottlenecks.map((item) => `- ${item}`)
        : ["- No measured bottlenecks in the current sample window."]),
      "",
      "## Known Limitations",
      "",
      ...report.knownLimitations.map((item) => `- ${item}`),
      "",
    ].join("\n");
  }

  private async queueSummaries(): Promise<QueuePerformanceSummary[]> {
    if (!this.redis.isAvailable) {
      return QUEUES.map((name) => ({ name, waiting: 0, delayed: 0, failed: 0, status: "UNKNOWN" }));
    }
    return Promise.all(QUEUES.map((name) => this.queueSummary(name)));
  }

  private async queueSummary(name: string): Promise<QueuePerformanceSummary> {
    try {
      const [waiting, delayed, failed] = await this.redis.measure(`queue_${name}`, async () => {
        const prefix = `bull:${name}`;
        return Promise.all([
          this.redis.cache.llen(`${prefix}:wait`),
          this.redis.cache.zcard(`${prefix}:delayed`),
          this.redis.cache.zcard(`${prefix}:failed`),
        ]);
      });
      return {
        name,
        waiting,
        delayed,
        failed,
        status: waiting > 100 || failed > 0 ? "BACKLOG" : "OK",
      };
    } catch {
      return { name, waiting: 0, delayed: 0, failed: 0, status: "UNKNOWN" };
    }
  }
}

function recommendation(gates: PerformanceGateResult[], queues: QueuePerformanceSummary[]) {
  if (gates.some((gate) => gate.status === "FAIL") || queues.some((queue) => queue.status === "BACKLOG")) {
    return "FAIL";
  }
  if (gates.some((gate) => gate.status === "UNKNOWN") || queues.some((queue) => queue.status === "UNKNOWN")) {
    return "PARTIAL";
  }
  return "PASS";
}

function bottlenecks(gates: PerformanceGateResult[], queues: QueuePerformanceSummary[]) {
  return [
    ...gates
      .filter((gate) => gate.status === "FAIL")
      .map((gate) => `${gate.label} p95 ${gate.p95}ms exceeds ${gate.targetMs}ms target.`),
    ...queues
      .filter((queue) => queue.status === "BACKLOG")
      .map((queue) => `${queue.name} backlog: waiting=${queue.waiting}, failed=${queue.failed}.`),
  ];
}

function cacheCounters(counters: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(counters).filter(
      ([name]) => name.includes("cache") || name.startsWith("redis_"),
    ),
  );
}
