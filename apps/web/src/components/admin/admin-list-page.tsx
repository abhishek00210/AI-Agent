"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";

export function AdminListPage({
  title,
  description,
  resource,
  columns,
}: {
  title: string;
  description: string;
  resource: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (row: Record<string, unknown>) => React.ReactNode;
  }>;
}) {
  const [q, setQ] = useState("");
  const query = new URLSearchParams();
  if (q.trim()) query.set("q", q.trim());
  const result = useQuery({
    queryKey: ["admin", resource, q],
    queryFn: () => adminApi.list(resource, query.toString()) as Promise<Record<string, unknown>[]>,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-300">Super Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p>
        </div>
        <button
          onClick={() => void result.refetch()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${result.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={`Search ${title.toLowerCase()}...`}
        className="h-11 w-full max-w-xl rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-teal-300"
      />
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(result.data ?? []).map((row, index) => (
              <tr key={String(row.id ?? index)} className="hover:bg-white/[0.03]">
                {columns.map((column) => (
                  <td key={column.key} className="max-w-[320px] truncate px-4 py-3 text-zinc-300">
                    {column.render ? column.render(row) : valueAt(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
            {!result.isLoading && !result.data?.length ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-zinc-500">
                  No records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function valueAt(row: Record<string, unknown>, key: string) {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, row);
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return String(value.length);
  return JSON.stringify(value);
}
