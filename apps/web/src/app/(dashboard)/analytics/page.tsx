"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarCheck,
  Clock3,
  DollarSign,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Target,
  UserRoundPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

type Range = "TODAY" | "7D" | "30D" | "CUSTOM";

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30D");
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(isoDate(new Date()));
  const query = range === "CUSTOM" ? `range=CUSTOM&from=${from}&to=${to}` : `range=${range}`;
  const analytics = useQuery({
    queryKey: ["analytics", query],
    queryFn: () => authApi.analytics(query),
    staleTime: 60_000,
  });
  const data = analytics.data;
  const kpis = useMemo(
    () =>
      data
        ? ([
            ["Total calls", data.overview.totalCalls, PhoneCall],
            ["Incoming", data.overview.incomingCalls, PhoneCall],
            ["Outgoing", data.overview.outgoingCalls, PhoneCall],
            ["Appointments", data.overview.appointments, CalendarCheck],
            ["Leads", data.overview.leads, UserRoundPlus],
            ["Conversion", `${format(data.overview.conversionRate)}%`, Target],
            ["AI minutes", format(data.overview.aiMinutes), Sparkles],
            ["Revenue", money(data.overview.revenue), DollarSign],
            ["Avg. call", duration(data.overview.averageCallDuration), Clock3],
          ] as const)
        : [],
    [data],
  );

  return (
    <div className="space-y-9">
      <PageHeader
        title="Analytics"
        description="Snapshot-backed business performance. Transactional tables are never scanned during dashboard requests."
        action={
          <button
            onClick={() => void analytics.refetch()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <RefreshCw className={`h-4 w-4 ${analytics.isFetching ? "animate-spin" : ""}`} />{" "}
            Refresh
          </button>
        }
      />

      <section className="flex flex-wrap items-center gap-2 border-y border-zinc-200 py-4 dark:border-zinc-800">
        {(["TODAY", "7D", "30D", "CUSTOM"] as Range[]).map((item) => (
          <button
            key={item}
            onClick={() => setRange(item)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${range === item ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
          >
            {item === "7D" ? "7 days" : item === "30D" ? "30 days" : title(item)}
          </button>
        ))}
        {range === "CUSTOM" ? (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 dark:border-zinc-800"
            />
            <span className="text-zinc-400">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 dark:border-zinc-800"
            />
          </div>
        ) : null}
      </section>

      {analytics.isLoading ? (
        <SkeletonBlock className="h-[680px]" />
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-x-8 gap-y-7 md:grid-cols-3 xl:grid-cols-5">
            {kpis.map(([label, value, Icon], index) => (
              <div
                key={label}
                className={`animate-in fade-in slide-in-from-bottom-1 duration-500 ${index === 0 ? "col-span-2 md:col-span-1" : ""}`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <Icon className="h-3.5 w-3.5 text-teal-600" />
                  {label}
                </div>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                  {typeof value === "number" ? format(value) : value}
                </p>
              </div>
            ))}
          </section>

          <section className="border-y border-zinc-200 py-7 dark:border-zinc-800">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="font-semibold">Performance over time</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Daily snapshots across calls, pipeline, revenue, and AI consumption.
                </p>
              </div>
              <span className="text-xs text-zinc-500">{data.series.length} daily snapshots</span>
            </div>
            <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-5">
              <Trend label="Calls" values={data.series.map((x) => x.calls)} color="#0d9488" />
              <Trend label="Leads" values={data.series.map((x) => x.leads)} color="#0d9488" />
              <Trend
                label="Appointments"
                values={data.series.map((x) => x.appointments)}
                color="#0d9488"
              />
              <Trend
                label="Revenue"
                values={data.series.map((x) => x.revenue)}
                color="#0d9488"
                prefix="$"
              />
              <Trend
                label="AI minutes"
                values={data.series.map((x) => x.aiMinutes)}
                color="#0d9488"
              />
            </div>
          </section>

          <section className="grid gap-10 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-4">
                <h2 className="font-semibold">Top agents</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Ranked by calls within the selected range.
                </p>
              </div>
              <div className="overflow-x-auto border-y border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="py-3 pr-5">Agent</th>
                      <th className="px-3 py-3 text-right">Calls</th>
                      <th className="px-3 py-3 text-right">Appointments</th>
                      <th className="px-3 py-3 text-right">Leads</th>
                      <th className="py-3 pl-3 text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {data.topAgents.map((agent) => (
                      <tr
                        key={agent.agentId}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="py-3.5 pr-5 font-medium">{agent.agentName}</td>
                        <td className="px-3 text-right tabular-nums">{agent.calls}</td>
                        <td className="px-3 text-right tabular-nums">{agent.appointments}</td>
                        <td className="px-3 text-right tabular-nums">{agent.leads}</td>
                        <td className="pl-3 text-right tabular-nums">
                          {format(agent.conversionRate)}%
                        </td>
                      </tr>
                    ))}
                    {!data.topAgents.length ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-zinc-500">
                          No agent activity in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-600" />
                <h2 className="font-semibold">Recent activity</h2>
              </div>
              <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {data.recentActivity.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {item.metadata.agentName ??
                          item.metadata.source ??
                          item.metadata.plan ??
                          "Platform"}
                      </p>
                    </div>
                    <time className="whitespace-nowrap text-xs text-zinc-500">
                      {dateTime(item.createdAt)}
                    </time>
                  </div>
                ))}
                {!data.recentActivity.length ? (
                  <p className="py-8 text-sm text-zinc-500">No recent activity.</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-6 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:grid-cols-4">
            <Detail label="MRR" value={money(data.revenue.mrr)} />
            <Detail label="AI responses" value={format(data.overview.aiResponses)} />
            <Detail label="AI tokens" value={format(data.overview.aiTokens)} />
            <Detail label="Tool executions" value={format(data.overview.toolExecutions)} />
          </section>
        </>
      ) : (
        <p className="text-sm text-red-600">Analytics could not be loaded.</p>
      )}
    </div>
  );
}

function Trend({
  label,
  values,
  color,
  prefix = "",
}: {
  label: string;
  values: number[];
  color: string;
  prefix?: string;
}) {
  const max = Math.max(1, ...values);
  const points =
    values.length < 2
      ? "0,38 100,38"
      : values
          .map(
            (value, index) => `${(index / (values.length - 1)) * 100},${42 - (value / max) * 38}`,
          )
          .join(" ");
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="group">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {prefix}
            {format(total)}
          </p>
        </div>
      </div>
      <svg
        viewBox="0 0 100 46"
        preserveAspectRatio="none"
        className="mt-3 h-16 w-full overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="transition-[stroke-width] duration-200 group-hover:[stroke-width:3]"
        />
      </svg>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function format(value: number) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 1,
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
  }).format(value);
}
function money(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}
function duration(seconds: number) {
  const rounded = Math.round(seconds);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}m ${rounded % 60}s` : `${rounded}s`;
}
function title(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
