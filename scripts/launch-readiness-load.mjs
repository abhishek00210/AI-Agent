import { monitorEventLoopDelay } from "node:perf_hooks";

const base = process.env.E2E_API_URL ?? "https://agent-api.zodo.ca/api/v1";
const web = process.env.E2E_WEB_URL ?? "https://agent.zodo.ca";
const token = process.env.E2E_ACCESS_TOKEN;
const levels = [1, 5, 20, 50];
const results = [];

for (const concurrency of levels) {
  for (const target of [
    { name: "health", url: `${base}/health`, targetP95Ms: 300 },
    { name: "dashboard", url: `${web}/dashboard`, targetP95Ms: 300 },
    ...(token ? [
      { name: "analytics", url: `${base}/analytics?range=30D`, targetP95Ms: 100 },
      { name: "customer_search", url: `${base}/customers?search=a`, targetP95Ms: 150 },
    ] : []),
  ]) {
    const lag = monitorEventLoopDelay({ resolution: 10 });
    lag.enable();
    const heapBefore = process.memoryUsage().heapUsed;
    const { timings: samples, failures } = await run(target.url, concurrency, 100, token);
    const heapGrowthBytes = process.memoryUsage().heapUsed - heapBefore;
    lag.disable();
    samples.sort((a, b) => a - b);
    const p50Ms = percentile(samples, 0.5);
    const p95Ms = percentile(samples, 0.95);
    const p99Ms = percentile(samples, 0.99);
    results.push({
      target: target.name,
      concurrency,
      samples: samples.length,
      failures,
      p50Ms,
      p95Ms,
      p99Ms,
      targetP95Ms: target.targetP95Ms,
      status: failures === 0 && p95Ms <= target.targetP95Ms ? "PASS" : "FAIL",
      eventLoopLagP99Ms: Number((lag.percentile(99) / 1e6).toFixed(3)),
      heapGrowthBytes,
    });
  }
}

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);

async function run(url, concurrency, count, bearer) {
  const timings = [];
  let failures = 0;
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < count) {
      next += 1;
      const started = performance.now();
      try {
        const response = await fetch(url, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        await response.arrayBuffer();
        timings.push(performance.now() - started);
      } catch {
        failures += 1;
      }
    }
  }));
  return { timings, failures };
}
function percentile(values, point) {
  if (values.length === 0) return null;
  return Number(values[Math.max(0, Math.ceil(values.length * point) - 1)].toFixed(3));
}
