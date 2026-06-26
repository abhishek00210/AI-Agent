"use client";

import { useQuery } from "@tanstack/react-query";
import type { UsageResource, UsageResourceSummary } from "@ai-agent-platform/types";
import { Activity, ArrowUpRight, Clock3, Gauge, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

const PRIMARY: Array<[UsageResource, string, string]> = [
  ["AI_MINUTES", "AI voice", "billable min"],
  ["SMS_MESSAGES", "SMS", "messages"],
  ["MESSAGES", "AI responses", "messages"],
  ["KNOWLEDGE_STORAGE_MB", "Knowledge storage", "MB"],
  ["APPOINTMENTS", "Appointments", "bookings"],
  ["AGENTS", "Agents", "active"],
];

const COST_SIGNALS: Array<[UsageResource, string]> = [
  ["AI_INPUT_TOKENS", "Input tokens"],
  ["AI_OUTPUT_TOKENS", "Output tokens"],
  ["REALTIME_VOICE_MINUTES", "Realtime voice"],
  ["TOOL_EXECUTIONS", "Tool executions"],
];

export default function UsagePage() {
  const summary = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: authApi.usageSummary,
    refetchInterval: 60_000,
  });
  const history = useQuery({
    queryKey: ["usage", "history"],
    queryFn: () => authApi.usageHistory(1, 12),
  });

  if (summary.isLoading) return <SkeletonBlock className="h-[760px]" />;
  const data = summary.data;

  return (
    <div className="space-y-9">
      <PageHeader
        title="Usage"
        description="Authoritative counters for this billing period. Updates appear within 60 seconds."
        action={
          <button
            type="button"
            onClick={() => void summary.refetch()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <RefreshCw className={`h-4 w-4 ${summary.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <section className="grid gap-8 border-y border-zinc-200 py-7 dark:border-zinc-800 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">
            {data?.plan ?? "—"} · {data?.state ?? "Unavailable"}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">
            {data ? periodLabel(data.periodStart, data.periodEnd) : "Current billing period"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Counters are updated atomically from successful product activity.
          </p>
        </div>
        <div className="md:text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Period progress</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {data ? `${periodProgress(data.periodStart, data.periodEnd)}%` : "—"}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Included usage</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Hard limits stop new metered activity at the allowance.
            </p>
          </div>
          <Link
            href="/plans"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-600"
          >
            Compare plans <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {data
            ? PRIMARY.map(([resource, label, unit]) => (
                <UsageLine
                  key={resource}
                  label={label}
                  unit={unit}
                  value={data.resources[resource]}
                  projected={data.projection[resource]?.projected ?? 0}
                />
              ))
            : null}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            <h2 className="text-base font-semibold">Cost signals</h2>
          </div>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {data
              ? COST_SIGNALS.map(([resource, label]) => (
                  <div key={resource} className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(data.values[resource])}
                    </span>
                  </div>
                ))
              : null}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-teal-600" />
            <h2 className="text-base font-semibold">Recent usage events</h2>
          </div>
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {history.data?.data.length ? (
              history.data.data.slice(0, 7).map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
                    {labelFor(event.resourceType)}
                  </span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-zinc-500">
                    {event.quantity > 0 ? "+" : ""}
                    {formatNumber(event.quantity)} · {formatTime(event.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-8 text-sm text-zinc-500">No usage events in this period yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="flex items-start gap-3 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
        <Gauge className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Overage quantities are calculated for forecasting only. Automatic overage billing is not
          enabled.
        </p>
      </section>
    </div>
  );
}

function UsageLine({
  label,
  unit,
  value,
  projected,
}: {
  label: string;
  unit: string;
  value: UsageResourceSummary;
  projected: number;
}) {
  const percent =
    value.limit === null ? 0 : Math.min(100, (value.used / Math.max(1, value.limit)) * 100);
  const warning = value.limit !== null && percent >= 80;
  return (
    <div className="grid gap-3 py-4 md:grid-cols-[180px_1fr_220px] md:items-center">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Projected {formatNumber(projected)} {unit}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${warning ? "bg-amber-500" : "bg-teal-600"}`}
          style={{ width: value.limit === null ? "0%" : `${percent}%` }}
        />
      </div>
      <div className="text-sm tabular-nums md:text-right">
        <span className="font-semibold">{formatNumber(value.used)}</span>
        <span className="text-zinc-500">
          {" "}
          / {value.limit === null ? "Unlimited" : formatNumber(value.limit)} {unit}
        </span>
      </div>
    </div>
  );
}

function periodLabel(start: string, end: string) {
  return `${new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(start))} – ${new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(end))}`;
}

function periodProgress(start: string, end: string) {
  const from = new Date(start).getTime();
  return Math.round(
    Math.min(1, Math.max(0, (Date.now() - from) / Math.max(1, new Date(end).getTime() - from))) *
      100,
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function labelFor(resource: UsageResource) {
  return resource
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
