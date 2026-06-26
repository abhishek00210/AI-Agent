"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw, RadioTower, XCircle } from "lucide-react";
import { adminApi } from "@/lib/admin-api";

export default function AdminProvidersPage() {
  const result = useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => adminApi.providers(),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-300">Telephony</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Provider health</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Authentication, connectivity, and bounded provider latency without exposing credentials.
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

      <div className="grid gap-4 md:grid-cols-2">
        {(result.data?.data ?? []).map((provider) => (
          <section
            key={provider.provider}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RadioTower className="h-5 w-5 text-teal-300" />
                <div>
                  <h2 className="font-semibold">{provider.provider}</h2>
                  <p className="text-xs text-zinc-500">{provider.status ?? "No status reported"}</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-sm ${provider.healthy ? "text-emerald-300" : "text-amber-300"}`}
              >
                {provider.healthy ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {provider.healthy
                  ? "Healthy"
                  : provider.configured
                    ? "Unavailable"
                    : "Not configured"}
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-black/20 p-3">
                <dt className="text-zinc-500">Latency</dt>
                <dd className="mt-1 font-medium">{provider.latencyMs} ms</dd>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <dt className="text-zinc-500">Configured</dt>
                <dd className="mt-1 font-medium">{provider.configured ? "Yes" : "No"}</dd>
              </div>
            </dl>
            {provider.error ? (
              <p className="mt-4 text-sm text-amber-300">{provider.error}</p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
