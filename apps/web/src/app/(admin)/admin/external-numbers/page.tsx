"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/admin-api";

interface AdminExternalNumber {
  id: string;
  organizationId: string;
  phoneNumber: string;
  status: string;
  countryCode: string;
  verifiedAt: string | null;
  forwardingConfirmedAt: string | null;
  forwardingTargetNumber: string | null;
  assignedAgentId: string | null;
  organization: { id: string; name: string };
  assignedAgent: { id: string; name: string } | null;
}

interface AdminAgent {
  id: string;
  organizationId: string;
  name: string;
  status: string;
}

export default function AdminExternalNumbersPage() {
  const queryClient = useQueryClient();
  const numbers = useQuery({
    queryKey: ["admin", "external-numbers"],
    queryFn: () => adminApi.list("external-numbers") as Promise<AdminExternalNumber[]>,
  });
  const agents = useQuery({
    queryKey: ["admin", "agents", "external-number-options"],
    queryFn: () => adminApi.list("agents") as Promise<AdminAgent[]>,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "external-numbers"] });
  const assign = useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string | null }) =>
      adminApi.post(`/admin/external-numbers/${id}/assign-agent`, { agentId }),
    onSuccess: refresh,
  });
  const disable = useMutation({
    mutationFn: (id: string) => adminApi.post(`/admin/external-numbers/${id}/disable`),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-300">Super Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Existing Number Forwarding</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Ownership, destination, test, and activation status across tenants.
          </p>
        </div>
        <button
          onClick={() => void numbers.refetch()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Business number</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Forward to</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Forwarding confirmed</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {(numbers.data ?? []).map((number) => {
              const options = (agents.data ?? []).filter(
                (agent) =>
                  agent.organizationId === number.organizationId && agent.status === "ACTIVE",
              );
              return (
                <tr key={number.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono">{number.phoneNumber}</td>
                  <td className="px-4 py-3">{number.organization.name}</td>
                  <td className="px-4 py-3">
                    <select
                      className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-2"
                      value={number.assignedAgentId ?? ""}
                      disabled={number.status === "DISABLED" || assign.isPending}
                      onChange={(event) =>
                        assign.mutate({ id: number.id, agentId: event.target.value || null })
                      }
                    >
                      <option value="">Unassigned</option>
                      {options.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {number.forwardingTargetNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">{number.status}</td>
                  <td className="px-4 py-3">{formatDate(number.verifiedAt)}</td>
                  <td className="px-4 py-3">{formatDate(number.forwardingConfirmedAt)}</td>
                  <td className="px-4 py-3">
                    {number.status !== "DISABLED" ? (
                      <button
                        className="text-red-300 hover:text-red-200"
                        onClick={() => {
                          if (window.confirm("Disable this external number?"))
                            disable.mutate(number.id);
                        }}
                      >
                        Disable
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {!numbers.isLoading && !numbers.data?.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                  No external numbers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}
