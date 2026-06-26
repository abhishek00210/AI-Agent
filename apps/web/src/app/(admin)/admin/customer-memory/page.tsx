"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";

interface MemoryEvent {
  id: string;
  organizationId: string;
  action: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function AdminCustomerMemoryPage() {
  const events = useQuery({
    queryKey: ["admin", "customer-memory-events"],
    queryFn: () => adminApi.list("customer-memory-events", "limit=200") as Promise<MemoryEvent[]>,
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-300">Recognition observability</p>
        <h1 className="mt-2 text-3xl font-semibold">Customer Memory</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Bounded memory loads, returning-customer recognition, prompt injection, and personalized greetings.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Time</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(events.data ?? []).map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3">{event.action.replaceAll("customer_memory.", "").replaceAll("_", " ")}</td>
                <td className="px-4 py-3 font-mono text-xs">{event.organizationId}</td>
                <td className="px-4 py-3 font-mono text-xs">{event.entityId ?? "—"}</td>
                <td className="px-4 py-3">{String(event.metadata.channel ?? "—")}</td>
                <td className="px-4 py-3">{new Date(event.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
