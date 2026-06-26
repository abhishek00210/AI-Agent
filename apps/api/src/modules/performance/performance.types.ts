export type PerformanceGateStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface PerformanceGateResult {
  key: string;
  label: string;
  targetMs: number;
  metric: string;
  status: PerformanceGateStatus;
  sampleCount: number;
  p50: number;
  p95: number;
  p99: number;
  note?: string;
}

export interface QueuePerformanceSummary {
  name: string;
  waiting: number;
  delayed: number;
  failed: number;
  status: "OK" | "BACKLOG" | "UNKNOWN";
}

export interface PerformanceAuditReport {
  generatedAt: string;
  launchRecommendation: "PASS" | "PARTIAL" | "FAIL";
  gates: PerformanceGateResult[];
  cache: {
    routingHitRate: number;
    globalHitRate: number;
    counters: Record<string, number>;
  };
  eventLoopLagMs: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  queues: QueuePerformanceSummary[];
  bottlenecks: string[];
  knownLimitations: string[];
}
