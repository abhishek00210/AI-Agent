import { Injectable } from "@nestjs/common";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type RealtimeMetricName =
  | "webhook_processing_ms"
  | "db_lookup_ms"
  | "redis_lookup_ms"
  | "openai_connect_ms"
  | "openai_connect_cold_ms"
  | "openai_connect_warm_ms"
  | "startup_context_ms"
  | "startup_context_cold_ms"
  | "startup_context_warm_ms"
  | "startup_session_ms"
  | "startup_memory_ms"
  | "startup_tools_ms"
  | "first_greeting_audio_ms"
  | "speech_started"
  | "speech_stopped"
  | "transcription_completed"
  | "endpointing_delay_ms"
  | "transcript_completion_ms"
  | "rag_embedding_ms"
  | "rag_vector_search_ms"
  | "rag_total_ms"
  | "response_created_ms"
  | "response_created_cold_ms"
  | "response_created_warm_ms"
  | "first_audio_delta_ms"
  | "twilio_first_audio_write_ms"
  | "barge_in_clear_ms"
  | "total_first_response_ms"
  | "total_first_response_cold_ms"
  | "total_first_response_warm_ms"
  | "telephony_provider_health_ms"
  | "payment_provider_health_ms";

export interface MetricSummary {
  count: number;
  success: number;
  failure: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface RealtimeMetricsSnapshot {
  distributions: Partial<Record<RealtimeMetricName, MetricSummary>>;
  counters: Record<string, number>;
  ratios: Record<string, number>;
  eventLoopLagMs: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
}

interface Distribution {
  values: number[];
  success: number;
  failure: number;
}

const MAX_SAMPLES = 10_000;
const PERSIST_EVERY_MS = 5_000;

@Injectable()
export class RealtimeMetricsService {
  private readonly distributions = new Map<RealtimeMetricName, Distribution>();
  private readonly counters = new Map<string, number>();
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 20 });
  private readonly persistPath = resolve(process.cwd(), ".runtime", "realtime-metrics.json");

  constructor() {
    if (process.env.NODE_ENV !== "test") {
      this.loadPersisted();
    }
    this.eventLoop.enable();
    if (process.env.NODE_ENV !== "test") {
      const interval = setInterval(() => void this.persist(), PERSIST_EVERY_MS);
      interval.unref?.();
    }
  }

  now(): number {
    return performance.now();
  }

  observe(name: RealtimeMetricName, startedAt: number, success = true): number {
    const duration = Math.max(0, performance.now() - startedAt);
    this.observeValue(name, duration, success);
    return duration;
  }

  observeValue(name: RealtimeMetricName, value: number, success = true): number {
    const duration = Math.max(0, value);
    const distribution = this.distributions.get(name) ?? {
      values: [],
      success: 0,
      failure: 0,
    };
    distribution.values.push(duration);
    if (distribution.values.length > MAX_SAMPLES) {
      distribution.values.shift();
    }
    if (success) {
      distribution.success += 1;
    } else {
      distribution.failure += 1;
    }
    this.distributions.set(name, distribution);
    return duration;
  }

  increment(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value);
  }

  snapshot(): RealtimeMetricsSnapshot {
    const counters = Object.fromEntries(this.counters);
    const routingHits = counters.routing_cache_hits ?? 0;
    const routingMisses = counters.routing_cache_misses ?? 0;
    const redisHits = sumBySuffix(counters, "_cache_hits");
    const redisMisses = sumBySuffix(counters, "_cache_misses");
    return {
      distributions: Object.fromEntries(
        [...this.distributions.entries()].map(([name, distribution]) => [
          name,
          summarize(distribution),
        ]),
      ),
      counters,
      ratios: {
        routingCacheHit:
          routingHits + routingMisses === 0
            ? 0
            : Number((routingHits / (routingHits + routingMisses)).toFixed(4)),
        cacheHit:
          redisHits + redisMisses === 0
            ? 0
            : Number((redisHits / (redisHits + redisMisses)).toFixed(4)),
      },
      eventLoopLagMs: {
        p50: nanosToMs(this.eventLoop.percentile(50)),
        p95: nanosToMs(this.eventLoop.percentile(95)),
        p99: nanosToMs(this.eventLoop.percentile(99)),
        max: nanosToMs(this.eventLoop.max),
      },
    };
  }

  prometheus() {
    const lines = [
      "# HELP realtime_counter_total Realtime voice counter totals.",
      "# TYPE realtime_counter_total counter",
      ...[...this.counters.entries()].map(
        ([name, value]) => `realtime_counter_total{name="${sanitizeLabel(name)}"} ${value}`,
      ),
      "# HELP realtime_latency_ms Realtime voice latency distribution in milliseconds.",
      "# TYPE realtime_latency_ms summary",
    ];
    for (const [name, distribution] of this.distributions.entries()) {
      const summary = summarize(distribution);
      lines.push(
        `realtime_latency_ms{name="${sanitizeLabel(name)}",quantile="0.5"} ${summary.p50}`,
        `realtime_latency_ms{name="${sanitizeLabel(name)}",quantile="0.95"} ${summary.p95}`,
        `realtime_latency_ms{name="${sanitizeLabel(name)}",quantile="0.99"} ${summary.p99}`,
        `realtime_latency_ms_count{name="${sanitizeLabel(name)}"} ${summary.count}`,
      );
    }
    lines.push(
      "# HELP realtime_event_loop_lag_ms Event loop lag distribution in milliseconds.",
      "# TYPE realtime_event_loop_lag_ms summary",
      `realtime_event_loop_lag_ms{quantile="0.5"} ${nanosToMs(this.eventLoop.percentile(50))}`,
      `realtime_event_loop_lag_ms{quantile="0.95"} ${nanosToMs(this.eventLoop.percentile(95))}`,
      `realtime_event_loop_lag_ms{quantile="0.99"} ${nanosToMs(this.eventLoop.percentile(99))}`,
    );
    return `${lines.join("\n")}\n`;
  }

  private loadPersisted() {
    try {
      const raw = readFileSync(this.persistPath, "utf8");
      const data = JSON.parse(raw) as {
        counters?: Record<string, number>;
        distributions?: Partial<Record<RealtimeMetricName, Distribution>>;
      };
      for (const [name, value] of Object.entries(data.counters ?? {})) {
        if (typeof value === "number" && Number.isFinite(value)) {
          this.counters.set(name, value);
        }
      }
      for (const [name, value] of Object.entries(data.distributions ?? {})) {
        if (isDistribution(value)) {
          this.distributions.set(name as RealtimeMetricName, {
            values: value.values.slice(-MAX_SAMPLES),
            success: value.success,
            failure: value.failure,
          });
        }
      }
    } catch {
      // Metrics persistence is best-effort and must never block realtime audio.
    }
  }

  private async persist() {
    try {
      await mkdir(dirname(this.persistPath), { recursive: true });
      await writeFile(
        this.persistPath,
        JSON.stringify({
          counters: Object.fromEntries(this.counters),
          distributions: Object.fromEntries(this.distributions),
        }),
      );
    } catch {
      // Metrics persistence is best-effort and must never block realtime audio.
    }
  }
}

function sumBySuffix(counters: Record<string, number>, suffix: string): number {
  return Object.entries(counters)
    .filter(([name]) => name.endsWith(suffix))
    .reduce((sum, [, value]) => sum + value, 0);
}

function summarize(distribution: Distribution) {
  const sorted = [...distribution.values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    success: distribution.success,
    failure: distribution.failure,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1);
  return Number((values[index] ?? 0).toFixed(3));
}

function nanosToMs(value: number): number {
  return Number((value / 1_000_000).toFixed(3));
}

function sanitizeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_:.-]/g, "_");
}

function isDistribution(value: unknown): value is Distribution {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Distribution;
  return (
    Array.isArray(candidate.values) &&
    candidate.values.every((sample) => typeof sample === "number") &&
    typeof candidate.success === "number" &&
    typeof candidate.failure === "number"
  );
}
