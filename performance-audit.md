# Day 58 Performance Audit

Generated: 2026-06-24

Launch recommendation: **PARTIAL until live call samples are collected after deployment**

## Scope

Day 58 is a latency hardening pass. No customer-facing business workflows were rebuilt. The implementation extends existing realtime metrics and adds a consolidated performance audit layer around the current voice pipeline.

## Critical Path

```text
Twilio webhook
  ↓
Routing lookup
  ↓
TwiML Media Stream
  ↓
Realtime session/context startup
  ↓
OpenAI Realtime
  ↓
First audio delta
  ↓
Twilio audio write
```

Non-critical writes remain outside the hot path:

- audit writes
- analytics writes
- timeline writes
- recording finalization
- transcript persistence
- summary generation

## Latency Gates

| Gate | Metric | Target |
| --- | --- | ---: |
| Webhook p95 | `webhook_processing_ms` | 20 ms |
| Redis p95 | `redis_lookup_ms` | 5 ms |
| Database hot lookup p95 | `db_lookup_ms` | 10 ms |
| RAG total p95 | `rag_total_ms` | 50 ms |
| OpenAI first audio p95 | `first_audio_delta_ms` | 300 ms |
| Total voice roundtrip p95 | `total_first_response_ms` | 700 ms |

The platform now reports `UNKNOWN` for gates without samples instead of claiming a pass.

## Optimizations Implemented

- Added `PerformanceModule`.
- Added `LatencyMetricsService` gate evaluation.
- Added `PerformanceAuditService` with launch recommendation, bottleneck detection, queue health, cache ratios, and event-loop lag.
- Added public Prometheus-compatible `/metrics`.
- Added authenticated `/performance/audit`.
- Added super-admin `/admin/performance` and `/admin/performance/report.md`.
- Added admin `/admin/performance` dashboard.
- Added Redis operation timing through `RedisService.measure()` and `redis_lookup_ms`.
- Added queue backlog probing for critical BullMQ queues.
- Added global cache hit-rate summary from bounded-cardinality counters.

## Existing Measurements Reused

- `webhook_processing_ms`
- `db_lookup_ms`
- `openai_connect_ms`
- `startup_context_ms`
- `startup_session_ms`
- `startup_memory_ms`
- `startup_tools_ms`
- `first_greeting_audio_ms`
- `endpointing_delay_ms`
- `transcript_completion_ms`
- `rag_embedding_ms`
- `rag_vector_search_ms`
- `rag_total_ms`
- `response_created_ms`
- `first_audio_delta_ms`
- `twilio_first_audio_write_ms`
- `barge_in_clear_ms`
- `total_first_response_ms`
- cold/warm response distributions

## Benchmark / Verification Commands

```bash
cd apps/api
./node_modules/.bin/jest --runInBand src/modules/performance src/common/metrics src/modules/realtime src/modules/media-stream src/modules/voice src/modules/outbound-call
../../node_modules/.bin/tsc --noEmit
./node_modules/.bin/nest build
```

Production checks after deploy:

```bash
curl -fsS https://agent-api.zodo.ca/api/v1/health
curl -fsS https://agent-api.zodo.ca/api/v1/metrics
curl -I https://admin-agent.zodo.ca/admin/performance
```

## Known Limitations

- OpenAI first-audio latency includes provider and network variance outside platform control.
- RAG latency only applies to knowledge/tool turns and must be reported separately from ordinary non-RAG turns.
- Load-test claims require enough live/simulated samples; do not claim p95/p99 pass from tiny sample counts.

## Capacity Notes

- Realtime audio buffers are bounded.
- Twilio and OpenAI audio backpressure counters are tracked.
- Recording remains fire-and-forget relative to live audio.
- Queue backlogs are now visible in the performance audit.

