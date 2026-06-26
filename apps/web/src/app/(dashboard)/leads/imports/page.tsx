"use client";

import type { LeadImportSummary } from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, PhoneCall, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function LeadImportsPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<LeadImportSummary | null>(null);
  const [strategy, setStrategy] = useState<"SKIP" | "UPDATE_EXISTING" | "CREATE_NEW">("SKIP");
  const [campaign, setCampaign] = useState({ name: "Imported Lead Follow-Up", assignedAgentId: "", campaignType: "FOLLOW_UP", scheduleType: "IMMEDIATE", scheduledAt: "" });
  const imports = useQuery({ queryKey: ["lead-imports"], queryFn: () => authApi.leadImports(100) });
  const agents = useQuery({ queryKey: ["agents", "active"], queryFn: () => authApi.agents({ status: "ACTIVE", limit: 100 }) });
  const upload = useMutation({ mutationFn: async () => { if (!file) throw new Error("Choose a CSV file first."); return authApi.uploadLeadCsv(file); }, onSuccess: async (result) => { setSelected(result); setFile(null); await queryClient.invalidateQueries({ queryKey: ["lead-imports"] }); } });
  const confirm = useMutation({ mutationFn: (id: string) => authApi.confirmLeadImport(id, strategy), onSuccess: async (result) => { setSelected(result); await queryClient.invalidateQueries({ queryKey: ["lead-imports"] }); await queryClient.invalidateQueries({ queryKey: ["leads"] }); } });
  const createCampaign = useMutation({ mutationFn: (id: string) => authApi.createCampaignFromLeadImport(id, { ...campaign, scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString() : undefined, assignedAgentId: campaign.assignedAgentId, campaignType: campaign.campaignType as never, scheduleType: campaign.scheduleType as never }), onSuccess: async (result) => { setSelected(result.import); await queryClient.invalidateQueries({ queryKey: ["lead-imports"] }); await queryClient.invalidateQueries({ queryKey: ["campaigns"] }); } });
  const active = selected ?? imports.data?.[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Bulk Lead Import" description="Upload CSV leads, let AI map unknown columns, validate duplicates, then explicitly approve campaign launch." action={<Button variant="outline" asChild><Link href="/leads">Back to leads</Link></Button>} />
      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm font-medium">CSV file<input className="mt-2 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}><FileUp className="h-4 w-4" /> Upload & preview</Button>
        </div>
        {upload.error ? <p className="mt-2 text-sm text-red-600">{upload.error instanceof Error ? upload.error.message : "Upload failed."}</p> : null}
      </section>

      {active ? <ImportPanel item={active} strategy={strategy} setStrategy={setStrategy} confirm={() => confirm.mutate(active.id)} confirming={confirm.isPending} campaign={campaign} setCampaign={setCampaign} agents={agents.data?.data ?? []} createCampaign={() => createCampaign.mutate(active.id)} campaignPending={createCampaign.isPending} /> : null}

      <section className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800"><h2 className="font-medium">Import history</h2><Button variant="outline" size="sm" onClick={() => imports.refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">Imported</th><th className="px-4 py-3">Invalid</th><th className="px-4 py-3">Duplicates</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{imports.data?.map((item) => <tr key={item.id}><td className="px-4 py-3">{item.fileName}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{item.rowsFound}</td><td className="px-4 py-3">{item.rowsImported}</td><td className="px-4 py-3">{item.rowsInvalid}</td><td className="px-4 py-3">{item.rowsDuplicate}</td><td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td><td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => setSelected(item)}>View</Button></td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function ImportPanel({ item, strategy, setStrategy, confirm, confirming, campaign, setCampaign, agents, createCampaign, campaignPending }: { item: LeadImportSummary; strategy: "SKIP" | "UPDATE_EXISTING" | "CREATE_NEW"; setStrategy: (value: "SKIP" | "UPDATE_EXISTING" | "CREATE_NEW") => void; confirm: () => void; confirming: boolean; campaign: { name: string; assignedAgentId: string; campaignType: string; scheduleType: string; scheduledAt: string }; setCampaign: (value: { name: string; assignedAgentId: string; campaignType: string; scheduleType: string; scheduledAt: string }) => void; agents: Array<{ id: string; name: string }>; createCampaign: () => void; campaignPending: boolean }) {
  const canConfirm = item.status === "PREVIEWED" || item.status === "FAILED";
  const canCampaign = item.status === "COMPLETED" && item.rowsImported > 0 && !item.campaignId;
  const campaignReady = Boolean(campaign.assignedAgentId && (campaign.scheduleType !== "SCHEDULED" || campaign.scheduledAt));
  return <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><h2 className="text-lg font-semibold">{item.fileName}</h2><div className="mt-4 grid gap-3 md:grid-cols-5">{stat("Rows", item.rowsFound)}{stat("Valid", item.rowsValid)}{stat("Invalid", item.rowsInvalid)}{stat("Duplicates", item.rowsDuplicate)}{stat("Imported", item.rowsImported)}</div><div className="mt-4 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"><p className="font-medium">AI column mapping</p><pre className="mt-2 overflow-auto text-xs text-zinc-500">{JSON.stringify(item.mapping, null, 2)}</pre></div>{canConfirm ? <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Duplicate handling<select className="mt-2 block rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950" value={strategy} onChange={(e) => setStrategy(e.target.value as never)}><option value="SKIP">Skip duplicates</option><option value="UPDATE_EXISTING">Update existing leads</option><option value="CREATE_NEW">Create new where unique</option></select></label><Button onClick={confirm} disabled={confirming}>Confirm import</Button></div> : null}{canCampaign ? <div className="mt-6 rounded-md border border-teal-200 bg-teal-50 p-4 dark:border-teal-900 dark:bg-teal-950/30"><h3 className="font-medium">Create campaign from imported leads</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">This will not start calling until you explicitly create/start the campaign. Estimated calls: {item.rowsImported}. Estimated minutes: {item.rowsImported * 3}.</p><div className="mt-3 grid gap-3 md:grid-cols-4"><input className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} /><select className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={campaign.assignedAgentId} onChange={(e) => setCampaign({ ...campaign, assignedAgentId: e.target.value })}><option value="">Choose agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><select className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" value={campaign.scheduleType} onChange={(e) => setCampaign({ ...campaign, scheduleType: e.target.value })}><option value="IMMEDIATE">Immediate</option><option value="SCHEDULED">Scheduled</option></select>{campaign.scheduleType === "SCHEDULED" ? <input className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" type="datetime-local" value={campaign.scheduledAt} onChange={(e) => setCampaign({ ...campaign, scheduledAt: e.target.value })} /> : null}</div><Button className="mt-3" onClick={createCampaign} disabled={campaignPending || !campaignReady}><PhoneCall className="h-4 w-4" /> Create campaign</Button></div> : null}</section>;
}
function stat(label: string, value: number) { return <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"><div className="text-xs text-zinc-500">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>; }
