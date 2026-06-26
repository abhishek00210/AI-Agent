"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type React from "react";
import { adminApi } from "@/lib/admin-api";

export default function AdminPerformancePage() {
  const result = useQuery({
    queryKey: ["admin", "performance"],
    queryFn: () => adminApi.performance(),
    refetchInterval: 30_000,
  });
  const report = result.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-300">Performance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Latency & Reliability
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Live p50/p95/p99 gate status for the voice pipeline. UNKNOWN means the system
            does not have enough samples to make an honest percentile claim yet.
          </p>
        </div>
        <button
          onClick={() => void result.refetch()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${result.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Launch recommendation" value={report.launchRecommendation} />
            <MetricCard label="Routing cache hit" value={`${Math.round(report.cache.routingHitRate * 100)}%`} />
            <MetricCard label="Global cache hit" value={`${Math.round(report.cache.globalHitRate * 100)}%`} />
            <MetricCard label="Event loop p95" value={`${report.eventLoopLagMs.p95} ms`} />
          </section>

          <section className="rounded-2xl border border-white/10">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="font-medium">Latency gates</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Gate</th>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Samples</th>
                    <th className="px-4 py-3">p50</th>
                    <th className="px-4 py-3">p95</th>
                    <th className="px-4 py-3">p99</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {report.gates.map((gate) => (
                    <tr key={gate.key} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-zinc-200">{gate.label}</td>
                      <td className="px-4 py-3 text-zinc-500">{gate.metric}</td>
                      <td className="px-4 py-3">{gate.targetMs} ms</td>
                      <td className="px-4 py-3">{gate.sampleCount}</td>
                      <td className="px-4 py-3">{gate.p50}</td>
                      <td className="px-4 py-3">{gate.p95}</td>
                      <td className="px-4 py-3">{gate.p99}</td>
                      <td className="px-4 py-3"><Status value={gate.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="Queue health">
              <div className="space-y-2">
                {report.queues.map((queue) => (
                  <div key={queue.name} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-zinc-300">{queue.name}</span>
                    <span className="text-zinc-500">
                      waiting {queue.waiting} · delayed {queue.delayed} · failed {queue.failed} · {queue.status}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Bottlenecks & limitations">
              <div className="space-y-3 text-sm text-zinc-400">
                {(report.bottlenecks.length ? report.bottlenecks : ["No measured bottlenecks in this sample window."]).map((item) => (
                  <p key={item} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    {item}
                  </p>
                ))}
                {report.knownLimitations.map((item) => (
                  <p key={item} className="flex gap-2">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                    {item}
                  </p>
                ))}
              </div>
            </Panel>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 p-10 text-center text-zinc-500">
          Loading performance report…
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 p-4">
      <h2 className="mb-4 font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Status({ value }: { value: "PASS" | "FAIL" | "UNKNOWN" }) {
  const className =
    value === "PASS"
      ? "text-emerald-300"
      : value === "FAIL"
        ? "text-red-300"
        : "text-amber-300";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {value === "PASS" ? <CheckCircle2 className="h-4 w-4" /> : null}
      {value}
    </span>
  );
}
