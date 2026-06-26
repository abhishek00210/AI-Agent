import { Injectable } from "@nestjs/common";
import {
  RealtimeMetricsService,
  type MetricSummary,
  type RealtimeMetricName,
} from "../../common/metrics/realtime-metrics.service";
import type { PerformanceGateResult } from "./performance.types";

interface LatencyGate {
  key: string;
  label: string;
  metric: RealtimeMetricName;
  targetMs: number;
  note?: string;
}

export const PERFORMANCE_GATES: LatencyGate[] = [
  {
    key: "webhook",
    label: "Webhook p95",
    metric: "webhook_processing_ms",
    targetMs: 20,
    note: "Twilio webhook routing and TwiML generation only.",
  },
  {
    key: "redis",
    label: "Redis p95",
    metric: "redis_lookup_ms",
    targetMs: 5,
    note: "Measured Redis operations through RedisService.measure().",
  },
  {
    key: "database",
    label: "Database hot lookup p95",
    metric: "db_lookup_ms",
    targetMs: 10,
    note: "Routing-critical database lookup.",
  },
  {
    key: "rag",
    label: "RAG total p95",
    metric: "rag_total_ms",
    targetMs: 50,
    note: "Knowledge turns only; non-RAG voice turns are measured separately.",
  },
  {
    key: "openai_first_response",
    label: "OpenAI first audio p95",
    metric: "first_audio_delta_ms",
    targetMs: 300,
    note: "Provider/network latency included; do not claim pass without samples.",
  },
  {
    key: "voice_roundtrip",
    label: "Total voice roundtrip p95",
    metric: "total_first_response_ms",
    targetMs: 700,
    note: "Non-tool, non-RAG conversational turns.",
  },
];

@Injectable()
export class LatencyMetricsService {
  constructor(private readonly metrics: RealtimeMetricsService) {}

  snapshot() {
    return this.metrics.snapshot();
  }

  prometheus() {
    return this.metrics.prometheus();
  }

  gates(): PerformanceGateResult[] {
    const snapshot = this.metrics.snapshot();
    return PERFORMANCE_GATES.map((gate) =>
      summarizeGate(gate, snapshot.distributions[gate.metric]),
    );
  }
}

function summarizeGate(
  gate: LatencyGate,
  summary: MetricSummary | undefined,
): PerformanceGateResult {
  if (!summary || summary.count === 0) {
    return {
      key: gate.key,
      label: gate.label,
      targetMs: gate.targetMs,
      metric: gate.metric,
      status: "UNKNOWN",
      sampleCount: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      note: gate.note,
    };
  }

  return {
    key: gate.key,
    label: gate.label,
    targetMs: gate.targetMs,
    metric: gate.metric,
    status: summary.p95 <= gate.targetMs ? "PASS" : "FAIL",
    sampleCount: summary.count,
    p50: summary.p50,
    p95: summary.p95,
    p99: summary.p99,
    note: gate.note,
  };
}
