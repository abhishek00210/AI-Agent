"use client";

import type { CreateLeadInput, LeadSource, LeadStatus, LeadSummary } from "@ai-agent-platform/types";
import { Button, cn } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, FileUp, MessageSquareText, Plus, RotateCcw, Search, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

const statuses: Array<"ALL" | LeadStatus> = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "BOOKED", "CUSTOMER", "LOST", "CLOSED"];
const sources: Array<"ALL" | LeadSource> = ["ALL", "VOICE", "CHAT", "WIDGET", "MANUAL", "IMPORT", "AI_AGENT"];
const emptyForm: CreateLeadInput = { name: "", phone: "", email: "", company: "", address: "", notes: "", source: "MANUAL", status: "NEW", countryCode: "IN", tags: [] };

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | LeadStatus>("ALL");
  const [source, setSource] = useState<"ALL" | LeadSource>("ALL");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [form, setForm] = useState<CreateLeadInput>(emptyForm);
  const [editing, setEditing] = useState<LeadSummary | null>(null);

  const leads = useQuery({
    queryKey: ["leads", { search, status, source, includeDeleted }],
    queryFn: () => authApi.leads({ limit: 100, search: search.trim() || undefined, status: status === "ALL" ? undefined : status, source: source === "ALL" ? undefined : source, includeDeleted }),
  });
  const agents = useQuery({ queryKey: ["agents", "active"], queryFn: () => authApi.agents({ status: "ACTIVE", limit: 100 }) });
  const save = useMutation({
    mutationFn: () => editing ? authApi.updateLead(editing.id, form) : authApi.createLead(form),
    onSuccess: async () => { setForm(emptyForm); setEditing(null); await queryClient.invalidateQueries({ queryKey: ["leads"] }); },
  });
  const remove = useMutation({ mutationFn: (id: string) => authApi.deleteLead(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }) });
  const restore = useMutation({ mutationFn: (id: string) => authApi.restoreLead(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }) });

  function edit(lead: LeadSummary) {
    setEditing(lead);
    setForm({ name: lead.contact.name, phone: lead.contact.phone ?? "", email: lead.contact.email ?? "", company: lead.contact.company ?? "", notes: lead.notes ?? "", status: lead.status, source: lead.source, assignedAgentId: lead.agent?.id, countryCode: "IN" });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Create, edit, import, and manage CRM leads before launching approved outbound campaigns." action={<Button asChild><Link href="/leads/imports"><FileUp className="h-4 w-4" /> Bulk import CSV</Link></Button>} />

      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Plus className="h-4 w-4" /> {editing ? "Edit lead" : "Create lead"}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="Phone e.g. 9876543210 or +1..." value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="field" placeholder="Email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" placeholder="Company" value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input className="field" placeholder="Address" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <select className="field" value={form.assignedAgentId ?? ""} onChange={(e) => setForm({ ...form, assignedAgentId: e.target.value || undefined })}>
            <option value="">No assigned agent</option>
            {agents.data?.data.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}>{statuses.filter((item) => item !== "ALL").map((item) => <option key={item}>{item}</option>)}</select>
          <select className="field" value={form.countryCode ?? "IN"} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}><option value="IN">India default</option><option value="US">United States</option><option value="CA">Canada</option><option value="GB">United Kingdom</option><option value="AU">Australia</option></select>
          <input className="field" placeholder="Tags comma separated" value={(form.tags ?? []).join(", ")} onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} />
          <textarea className="field md:col-span-3" placeholder="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Indian local mobile numbers are normalized to E.164, e.g. 9876543210 → +919876543210.</p>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || (!form.phone && !form.email)}>{editing ? "Save changes" : "Create lead"}</Button>
          {editing ? <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button> : null}
        </div>
        {save.error ? <p className="mt-2 text-sm text-red-600">{save.error instanceof Error ? save.error.message : "Unable to save lead."}</p> : null}
      </section>

      <section className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[1fr_180px_180px_160px]">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" /><input className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="Search name, phone, email, or company" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value as "ALL" | LeadStatus)}>{statuses.map((value) => <option key={value} value={value}>{value === "ALL" ? "All statuses" : label(value)}</option>)}</select>
        <select className="field" value={source} onChange={(event) => setSource(event.target.value as "ALL" | LeadSource)}>{sources.map((value) => <option key={value} value={value}>{value === "ALL" ? "All sources" : label(value)}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} /> Show deleted</label>
      </section>

      {leads.error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{leads.error instanceof Error ? leads.error.message : "Unable to load leads."}</div> : null}
      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800"><tr><th className="px-6 py-3">Contact</th><th className="px-6 py-3">Phone</th><th className="px-6 py-3">Source</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Agent</th><th className="px-6 py-3">Score</th><th className="px-6 py-3">Last interaction</th><th className="px-6 py-3">Actions</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {leads.isLoading ? <tr><td className="p-6" colSpan={8}><SkeletonBlock className="h-24" /></td></tr> : null}
          {leads.data?.data.map((lead) => <tr key={lead.id} className={lead.deletedAt ? "opacity-50" : ""}><td className="px-6 py-4"><div className="font-medium">{lead.contact.name}</div><div className="mt-1 text-xs text-zinc-500">{lead.contact.email ?? lead.contact.company ?? "No email"}</div></td><td className="px-6 py-4">{lead.contact.phone ?? "—"}</td><td className="px-6 py-4">{label(lead.source)}</td><td className="px-6 py-4"><span className={cn("rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300")}>{label(lead.status)}</span></td><td className="px-6 py-4">{lead.agent?.name ?? "—"}</td><td className="px-6 py-4">{lead.score}</td><td className="px-6 py-4 text-zinc-500">{new Date(lead.lastInteractionAt ?? lead.createdAt).toLocaleString()}</td><td className="px-6 py-4"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => edit(lead)}><Edit3 className="h-4 w-4" /> Edit</Button>{lead.deletedAt ? <Button variant="outline" size="sm" onClick={() => restore.mutate(lead.id)}><RotateCcw className="h-4 w-4" /> Restore</Button> : <Button variant="outline" size="sm" onClick={() => remove.mutate(lead.id)}><Trash2 className="h-4 w-4" /> Delete</Button>}<Button variant="outline" size="sm" asChild><Link href="/communications"><MessageSquareText className="h-4 w-4" /> SMS</Link></Button></div></td></tr>)}
        </tbody></table></div>
        {!leads.isLoading && leads.data?.data.length === 0 ? <div className="p-6"><EmptyState icon={UsersRound} title="No leads yet" description="Create a lead manually or import a CSV to begin." /></div> : null}
      </section>
    </div>
  );
}

function label(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
