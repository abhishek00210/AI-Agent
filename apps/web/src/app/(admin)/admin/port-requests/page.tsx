"use client";

import type { PortRequest, PortRequestStatus } from "@ai-agent-platform/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";

const statuses: PortRequestStatus[] = ["PENDING","DOCUMENT_REQUIRED","SUBMITTED","PROCESSING","REJECTED","APPROVED","COMPLETED","FAILED","CANCELLED"];

export default function AdminPortRequestsPage() {
  const client = useQueryClient();
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [estimates, setEstimates] = useState<Record<string,string>>({});
  const ports = useQuery({ queryKey: ["admin","port-requests"], queryFn: () => adminApi.list("port-requests") as Promise<PortRequest[]> });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PortRequestStatus }) => adminApi.patch(`/admin/port-requests/${id}`, { status, statusMessage: notes[id] || undefined, estimatedPortDate: estimates[id] || undefined }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin","port-requests"] }),
  });
  const openLoa = async (id: string) => { const result = await adminApi.list(`port-requests/${id}/loa/download`) as unknown as { url: string }; window.open(result.url, "_blank", "noopener,noreferrer"); };
  return <div className="space-y-6">
    <div className="flex items-end justify-between"><div><p className="text-sm font-medium text-teal-300">Super Admin</p><h1 className="mt-2 text-3xl font-semibold">Phone Number Porting</h1><p className="mt-2 text-sm text-zinc-500">Review LOAs, synchronize carrier status, and activate completed Twilio ports.</p></div><button onClick={() => void ports.refetch()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button></div>
    <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[1280px] text-sm"><thead className="bg-white/[.03] text-left text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Number</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Agent</th><th className="px-4 py-3">LOA</th><th className="px-4 py-3">Estimate</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3">Status</th></tr></thead>
      <tbody className="divide-y divide-white/10">{(ports.data ?? []).map((port) => <tr key={port.id} className="hover:bg-white/[.03]"><td className="px-4 py-3 font-mono">{port.phoneNumber}</td><td className="px-4 py-3">{(port as PortRequest & { organization?: { name: string } }).organization?.name ?? port.organizationId}</td><td className="px-4 py-3">{port.currentCarrier}</td><td className="px-4 py-3">{port.assignedAgent?.name ?? "—"}</td><td className="px-4 py-3">{port.loaDocument ? <button className="inline-flex items-center gap-1 text-teal-300" onClick={() => void openLoa(port.id)}>{port.loaDocument.originalFileName}<ExternalLink className="h-3 w-3" /></button> : "Missing"}</td><td className="px-4 py-3"><input type="date" className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1" value={estimates[port.id] ?? port.estimatedPortDate?.slice(0,10) ?? ""} onChange={(event) => setEstimates({ ...estimates, [port.id]: event.target.value })} /></td><td className="px-4 py-3"><input className="w-56 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1" placeholder={port.statusMessage ?? "Status note"} value={notes[port.id] ?? ""} onChange={(event) => setNotes({ ...notes, [port.id]: event.target.value })} /></td><td className="px-4 py-3"><select className="rounded-lg border border-white/10 bg-zinc-950 px-2 py-1" value={port.status} disabled={update.isPending || port.status === "CANCELLED"} onChange={(event) => update.mutate({ id: port.id, status: event.target.value as PortRequestStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>
  </div>;
}
