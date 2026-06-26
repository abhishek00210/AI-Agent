# Realtime Voice Production QA Audit

Date: 2026-06-18  
Code commit: `bcd2bf9` (runtime fixes), followed by an audit-evidence commit.

## Executive Verdict

The direct Twilio PCMU/8000 -> backend WebSocket -> OpenAI Realtime WebSocket ->
Twilio playback architecture is present and deployed. Ordinary turns are automatic
Realtime responses and do not wait for transcription or RAG. The audited release
passes typecheck, lint, build, 68 test suites, 233 tests, 1/5/20/50-call synthetic
stress, public health, and signed/unsigned WebSocket handshake checks.

Provider-dependent conversational latency gates are **PARTIAL**, not PASS: the
persisted production metric set contained zero post-instrumentation conversational
turn samples. At least 100 representative live turns are required.

## Findings, Ordered by Severity

### High — fixed: unauthenticated Media Streams WebSocket upgrades

The HTTP webhook validated Twilio signatures, but the raw WebSocket upgrade did not.
An attacker could attempt to create spoofed media sessions. The gateway now validates
the lowercase `x-twilio-signature` against the configured public `wss` URL before
allocating connection state. Production evidence: invalid signature `403`; valid
signature `101`.

Reference: `apps/api/src/modules/media-stream/media-stream.gateway.ts:48`.

### High — fixed: interruption before first audio did not cancel OpenAI

Barge-in cancellation previously depended on an assistant playback item. A response
interrupted after `response.created` but before its first output item was not cancelled.
Cancellation is now keyed to active response state, deduplicated across repeated
`speech_started`, tolerant of closed sockets, and pending continuations remain
serialized until `response.done`.

Reference: `apps/api/src/modules/realtime/realtime-event-processor.ts:396`.

### Medium — fixed: endpointing metric understated VAD delay

The old measurement started at the latest Twilio media frame. Twilio sends continuous
frames, including silence, so the result tended toward one packet interval instead of
actual endpointing delay. It now maps OpenAI `audio_end_ms` onto a monotonic input-audio
timeline.

References: `apps/api/src/modules/realtime/realtime.gateway.ts:178`,
`apps/api/src/modules/realtime/realtime-event-processor.ts:93`.

### Medium — fixed: exact FAQ lookup was outside strict retrieval cancellation

Embedding already accepted `AbortSignal` and vector search used PostgreSQL statement
timeout, but the exact FAQ lookup could outlive the realtime timeout. It now receives
the same bounded PostgreSQL statement timeout, and abort state is checked immediately
after the query.

References: `apps/api/src/modules/rag/retrieval.service.ts:50`,
`apps/api/src/modules/rag/repositories/rag.repository.ts:51`.

### Medium — fixed: cold/warm and Twilio-write metric semantics

Cold/warm response buckets were based only on startup-knowledge cache warmth. They now
include actual OpenAI connection coldness. The canonical requested metric name is now
`twilio_first_audio_write_ms`. Startup memory, tools, and greeting audio are also
measured.

References: `apps/api/src/modules/realtime/realtime.gateway.ts:105`,
`apps/api/src/common/metrics/realtime-metrics.service.ts:7`.

### Medium — fixed: `search_knowledge` bypassed ToolRegistry

The definition was appended directly to session tools. It is now registered through
`ToolRegistryService`, while execution remains specially tenant-scoped to active call
context.

References: `apps/api/src/modules/tool/tool-registry.service.ts:12`,
`apps/api/src/modules/realtime/realtime.gateway.ts:125`.

### Low — fixed: identifiers in operational warning logs

WebSocket connection IDs, Stream SIDs, job IDs, recording paths, phone numbers and
Call SIDs were removed from affected warning messages. Metrics labels remain bounded.

### Remaining stress observation

The deliberately bursty in-process benchmark recorded event-loop p95 up to 78.539 ms
at 20 streams. This sends packets much faster than realtime and did not produce dropped
recording bytes, backpressure, or unbounded retained heap, but it remains a useful
capacity warning. A paced, provider-connected soak test is still required.

## Architecture Evidence

- PCMU input/output and Realtime session update:
  `apps/api/src/modules/realtime/realtime.gateway.ts:129`.
- `semantic_vad`, configurable server VAD, `create_response: true`, and
  `interrupt_response: true`: `apps/api/src/modules/realtime/realtime.gateway.ts:306`.
- Transcription only enqueues deferred persistence and never invokes RAG or
  `response.create`: `apps/api/src/modules/realtime/realtime-event-processor.ts:83`.
- Optional tenant-scoped RAG tool: `apps/api/src/modules/realtime/realtime-knowledge.service.ts:83`.
- OpenAI forwarding precedes recording capture:
  `apps/api/src/modules/realtime/realtime-audio-bridge.ts:15`.
- Bounded OpenAI/Twilio transport buffers:
  `apps/api/src/modules/realtime/realtime-connection-manager.ts:110` and
  `apps/api/src/modules/media-stream/media-stream.gateway.ts:167`.

## Validation Commands and Results

```bash
cd apps/api
npm run typecheck
npm run lint
npm run build
npm test -- --runInBand
npm run benchmark:recording
```

- TypeScript: PASS
- ESLint: PASS
- Nest API build: PASS
- Jest: PASS — 68/68 suites, 233/233 tests
- Focused interruption/security/RAG/backpressure tests: PASS
- Synthetic concurrency: PASS at 1, 5, 20 and 50 calls

Full regression includes authentication/guards, agents, knowledge bases, document
processing, embeddings, RAG, memory, conversations, widget, calls, recordings,
transcripts, tools, leads, appointments, Twilio signatures, WebSocket media services,
storage, and website extraction.

## Measured Synthetic Percentiles

Each tier used 500 20-ms PCMU frames per call. These values measure in-process hot
path only; they exclude Twilio, OpenAI, PSTN, network, database, Redis, disk and S3.

| Calls | Samples | Recording p50/p95/p99 (µs) | OpenAI audio -> Twilio write p50/p95/p99 (µs) | Event-loop p50/p95/p99 (ms) | Retained heap |
|---:|---:|---:|---:|---:|---:|
| 1 | 500 | 1.500 / 6.542 / 14.958 | 0.417 / 0.500 / 3.542 | 1.080 / 1.491 / 1.491 | -103,352 B |
| 5 | 2,500 | 0.875 / 2.292 / 11.791 | 0.333 / 0.500 / 0.667 | 0.049 / 20.282 / 20.282 | 89,808 B |
| 20 | 10,000 | 0.750 / 1.792 / 6.500 | 0.167 / 0.459 / 1.291 | 5.005 / 78.539 / 78.539 | 212,600 B |
| 50 | 25,000 | 0.625 / 1.584 / 5.125 | 0.125 / 0.458 / 1.125 | 1.900 / 23.392 / 23.392 | 619,024 B |

Dropped recording bytes: 0 at every tier. Backpressure events in the normal synthetic
transport: 0. Separate forced slow-socket tests verified stale input/output frames are
dropped at configured bounds.

## Cold Versus Warm and Latency Gates

Production persistence was inspected without reading transcripts, phone numbers or
call IDs. It contained zero latency distributions and zero counters after the prior
metrics rollout. Therefore no provider or conversational percentile has the required
100 samples.

| Gate | Result | Evidence |
|---|---|---|
| Warm webhook p95 < 20 ms | PARTIAL | Instrumented; 0 qualifying production samples |
| Database hot lookup p95 < 10 ms | PARTIAL | Instrumented; 0 qualifying production samples |
| RAG vector search p95 < 50 ms | PARTIAL | Instrumented; 0 qualifying production samples |
| Endpoint -> response-created p95 < 300 ms | PARTIAL | Corrected instrumentation; 0 live turn samples |
| First OpenAI audio -> Twilio write p95 < 20 ms | PASS (in-process only) | 25,000-sample 50-call p95 0.458 µs |
| Non-RAG total perceived p95 < 700 ms | PARTIAL | Instrumented separately cold/warm; 0 live turn samples |

Tool/RAG turns are separated through embedding, vector, RAG-total, timeout,
cancellation, failure and cache metrics. Provider connection setup is not included in
conversational turn latency.

## Security Results

| Test | Result |
|---|---|
| Invalid Twilio HTTP signature | PASS |
| Invalid Twilio WebSocket signature | PASS — production 403 |
| Valid Twilio WebSocket signature | PASS — production 101 |
| Orphan CallSid / inactive agent | PASS — scoped start/context tests |
| Duplicate stream/tool events | PASS — idempotency and isolation tests |
| Cross-tenant RAG context | PASS — organization/KB values from model ignored |
| Cross-tenant recordings/transcripts | PASS — repository/service tenant filters |
| Disabled phone/agent | PASS |
| Malformed WebSocket/media events | PASS |
| Unauthorized tool execution | PASS — active-call tenant context enforced |

## Recording and Transcription Results

- Recording capture is deferred and bounded; no synchronous file write per packet.
- Overflow drops recording bytes before delaying live audio.
- BullMQ job IDs contain no colon and are deterministic where idempotency is required.
- Upload cleanup occurs only after successful upload; retry tests reach AVAILABLE.
- Unexpected disconnect closes buffers and finalizes recording.
- Transcription is enqueued after recording becomes AVAILABLE.
- Transcription failures are isolated from call history and tenant-scoped.
- Signed download URL and tenant isolation tests pass.

## Section Verdicts

| Section | Verdict | Reason |
|---:|---|---|
| 1. Architecture | PASS | Direct Realtime speech-to-speech; no transcript gate |
| 2. Audio hot path | PASS | Bounded, storage-free frame path; forced backpressure tested |
| 3. Turn detection | PARTIAL | Code/metrics tests pass; no representative acoustic corpus/live calls |
| 4. Barge-in | PASS | Before-audio, repeated, stale, tool, no-active, close cases pass |
| 5. RAG | PARTIAL | Tenant/timeout/cache/failure tests pass; no live PDF/site/FAQ dataset run |
| 6. Startup | PARTIAL | Concurrency and instrumentation pass; no live OpenAI greeting samples |
| 7. Recording/transcription | PASS | Queue, retry, disconnect, storage and worker tests pass |
| 8. Metrics | PARTIAL | Monotonic/persistence/Prometheus implemented; production sample set empty |
| 9. Security | PASS | Unit and production handshake evidence pass |
| 10. Concurrency | PASS | 1/5/20/50 isolation and bounded-memory tests pass |
| 11. Latency gates | PARTIAL | Hot-path gate proven synthetically; provider gates lack 100 live turns |
| 12. Regression | PASS | 68 suites / 233 tests plus build/lint/typecheck |

## Deployment Verification

- VPS: existing Phoenix deployment, PM2 `ai-agent-platform-api`.
- Build completed before restart; no `dist/main.js` restart race.
- PM2: online, `unstable_restarts: 0`.
- Public health: HTTP 200; database and Redis configured.
- WebSocket invalid signature: 403.
- WebSocket valid signature: 101.
- Startup log: Media Stream WebSocket ready and Nest application started.

## Remaining Risks

1. At least 100 live non-RAG turns, plus separate knowledge/tool turns, are needed for
   cold/warm provider percentile claims.
2. Semantic VAD needs a real US/Canada acoustic corpus covering quiet speech, fillers,
   background noise, trailing speech and mid-sentence pauses.
3. A paced 50-call provider-connected soak should confirm event-loop lag, PSTN jitter,
   queue completion, transcription completion and disconnect rates under real timing.
4. Metrics persistence is local to the VPS. It survives process restarts but is not a
   multi-host time-series backend.
