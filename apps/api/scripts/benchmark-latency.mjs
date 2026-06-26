/* global fetch */
import process from "node:process";
import { performance } from "node:perf_hooks";

const target = process.env.BENCHMARK_URL ?? "http://localhost:4000/api/v1/health";
const requests = Number(process.env.BENCHMARK_REQUESTS ?? 500);
const concurrency = Number(process.env.BENCHMARK_CONCURRENCY ?? 20);
const method = process.env.BENCHMARK_METHOD ?? "GET";
const body = process.env.BENCHMARK_BODY;
const headers = process.env.BENCHMARK_HEADERS
  ? JSON.parse(process.env.BENCHMARK_HEADERS)
  : {};

const durations = [];
let cursor = 0;
let failures = 0;

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < requests) {
      cursor += 1;
      const startedAt = performance.now();
      try {
        const response = await fetch(target, {
          method,
          headers,
          body: body && method !== "GET" ? body : undefined,
        });
        await response.arrayBuffer();
        if (!response.ok) failures += 1;
      } catch {
        failures += 1;
      } finally {
        durations.push(performance.now() - startedAt);
      }
    }
  }),
);

durations.sort((a, b) => a - b);
const percentile = (value) =>
  Number(
    (durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)] ?? 0).toFixed(
      3,
    ),
  );

process.stdout.write(
  `${JSON.stringify(
    {
      target,
      requests,
      concurrency,
      failures,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
    },
    null,
    2,
  )}\n`,
);
