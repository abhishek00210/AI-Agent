"use client";

import type { AiCallSummary } from "@ai-agent-platform/types";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";

type AdminSummary = AiCallSummary & {
  organization: { id: string; name: string };
  customerProfile: { id: string; name: string; phone: string | null; email: string | null };
};

export default function AdminCallSummariesPage() {
  const summaries = useQuery({
    queryKey: ["admin", "call-summaries"],
    queryFn: () => adminApi.list("call-summaries") as Promise<AdminSummary[]>,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-300">Conversation Intelligence</p>
        <h1 className="mt-2 text-3xl font-semibold">AI Call Summaries</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Structured transcript summaries across every organization.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Intent</th>
              <th className="px-4 py-3">Sentiment</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3">Generated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(summaries.data ?? []).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  {item.customerProfile.name}
                  <div className="text-xs text-zinc-500">{item.call?.callerNumber}</div>
                </td>
                <td className="px-4 py-3">{item.organization.name}</td>
                <td className="px-4 py-3">{item.intent}</td>
                <td className="px-4 py-3">{item.sentiment}</td>
                <td className="px-4 py-3">{item.outcome.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{item.followUpRequired ? "Required" : "No"}</td>
                <td className="px-4 py-3">
                  {new Date(item.generatedAt).toLocaleString()}
                  <div className="text-xs text-zinc-500">{item.model}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
