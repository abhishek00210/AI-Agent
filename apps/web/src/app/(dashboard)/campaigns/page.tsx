"use client";

import type { CampaignStatus, CampaignType } from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

const types: CampaignType[] = ["FOLLOW_UP", "RE_ENGAGEMENT", "REMINDER", "SALES_OUTREACH"];

export default function CampaignsPage() {
  const client = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("FOLLOW_UP");
  const [agentId, setAgentId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => authApi.campaigns({ limit: 100 }) });
  const agents = useQuery({ queryKey: ["agents", "campaigns"], queryFn: () => authApi.agents({ status: "ACTIVE", limit: 100 }), enabled: showCreate });
  const customers = useQuery({ queryKey: ["customers", "campaigns"], queryFn: () => authApi.customers(), enabled: showCreate });
  const create = useMutation({
    mutationFn: () => authApi.createCampaign({
      name,
      campaignType,
      assignedAgentId: agentId,
      scheduleType: "IMMEDIATE",
      customerProfileIds: selected,
    }),
    onSuccess: async () => {
      setShowCreate(false);
      setName("");
      setSelected([]);
      await client.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound campaigns"
        description="Select customers and run serialized AI calling campaigns through the existing outbound engine."
        action={<Button onClick={() => setShowCreate((value) => !value)}>New campaign</Button>}
      />

      {showCreate ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Campaign name"><input className={inputClass} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Type">
              <select className={inputClass} value={campaignType} onChange={(event) => setCampaignType(event.target.value as CampaignType)}>
                {types.map((type) => <option key={type} value={type}>{format(type)}</option>)}
              </select>
            </Field>
            <Field label="AI agent">
              <select className={inputClass} value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                <option value="">Select agent</option>
                {(agents.data?.data ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Targets ({selected.length})</p>
            <div className="max-h-56 divide-y overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              {(customers.data ?? []).filter((customer) => customer.phone).map((customer) => (
                <label key={customer.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(customer.id)}
                    onChange={(event) => setSelected((current) => event.target.checked ? [...current, customer.id] : current.filter((id) => id !== customer.id))}
                  />
                  <span className="font-medium">{customer.name}</span>
                  <span className="text-zinc-500">{customer.phone}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button disabled={!name.trim() || !agentId || !selected.length || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create draft"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            {create.error ? <span className="text-sm text-red-600">{create.error.message}</span> : null}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.4fr_150px_130px_100px_130px_120px] border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          <span>Campaign</span><span>Type</span><span>Status</span><span>Targets</span><span>Calls</span><span>Conversion</span>
        </div>
        {(campaigns.data ?? []).map((campaign) => (
          <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="grid grid-cols-[1.4fr_150px_130px_100px_130px_120px] items-center border-b px-4 py-4 text-sm last:border-0 dark:border-zinc-900">
            <div><p className="font-medium">{campaign.name}</p><p className="text-xs text-zinc-500">{campaign.assignedAgent.name}</p></div>
            <span>{format(campaign.campaignType)}</span>
            <Status value={campaign.status} />
            <span>{campaign.metrics.targets}</span>
            <span>{campaign.metrics.callsCompleted}/{campaign.metrics.callsCreated}</span>
            <span>{campaign.metrics.conversionRate.toFixed(1)}%</span>
          </Link>
        ))}
        {!campaigns.isLoading && !campaigns.data?.length ? <p className="p-8 text-center text-sm text-zinc-500">No campaigns yet.</p> : null}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}
function Status({ value }: { value: CampaignStatus }) {
  return <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-900">{format(value)}</span>;
}
const inputClass = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950";
function format(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
