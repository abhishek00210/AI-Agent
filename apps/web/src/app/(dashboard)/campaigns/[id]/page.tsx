"use client";

import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function CampaignDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["campaign", id], queryFn: () => authApi.campaign(id) });
  const action = useMutation({
    mutationFn: (operation: "start" | "pause" | "resume" | "cancel") => ({ start: authApi.startCampaign, pause: authApi.pauseCampaign, resume: authApi.resumeCampaign, cancel: authApi.cancelCampaign })[operation](id),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ["campaign", id] }), client.invalidateQueries({ queryKey: ["campaigns"] })]);
    },
  });
  const campaign = query.data;
  if (!campaign) return <p className="p-8 text-sm text-zinc-500">Loading campaign…</p>;
  return (
    <div className="space-y-6">
      <PageHeader title={campaign.name} description={`${format(campaign.campaignType)} · ${campaign.assignedAgent.name}`} action={
        <div className="flex gap-2">
          {["DRAFT", "SCHEDULED"].includes(campaign.status) ? <Button onClick={() => action.mutate("start")}>Start</Button> : null}
          {campaign.status === "RUNNING" ? <Button variant="outline" onClick={() => action.mutate("pause")}>Pause</Button> : null}
          {campaign.status === "PAUSED" ? <Button onClick={() => action.mutate("resume")}>Resume</Button> : null}
          {!(["COMPLETED", "CANCELLED"].includes(campaign.status)) ? <Button variant="ghost" onClick={() => action.mutate("cancel")}>Cancel</Button> : null}
        </div>
      } />
      <section className="grid gap-4 md:grid-cols-5">
        {Object.entries({ Targets: campaign.metrics.targets, "Calls completed": campaign.metrics.callsCompleted, "Connection rate": `${campaign.metrics.connectionRate.toFixed(1)}%`, "Qualification rate": `${campaign.metrics.qualificationRate.toFixed(1)}%`, "Appointment rate": `${campaign.metrics.appointmentRate.toFixed(1)}%` }).map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>
        ))}
      </section>
      <section className="overflow-hidden rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid grid-cols-[1.4fr_130px_100px_150px_140px] border-b px-4 py-3 text-xs uppercase text-zinc-500 dark:border-zinc-800"><span>Customer</span><span>Target status</span><span>Attempts</span><span>Call outcome</span><span>Conversion</span></div>
        {(campaign.targets ?? []).map((target) => (
          <div key={target.id} className="grid grid-cols-[1.4fr_130px_100px_150px_140px] border-b px-4 py-4 text-sm last:border-0 dark:border-zinc-900">
            <div><p className="font-medium">{target.customerProfile.name}</p><p className="text-xs text-zinc-500">{target.customerProfile.phone}</p></div>
            <span>{format(target.status)}</span><span>{target.attemptCount}</span><span>{target.outboundCall ? format(target.outboundCall.status) : "—"}</span><span>{target.outboundCall?.appointmentBooked ? "Appointment" : target.outboundCall?.qualified ? "Qualified" : "—"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
function format(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
