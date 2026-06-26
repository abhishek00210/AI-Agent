"use client";

import type { PhoneNumberStatus } from "@ai-agent-platform/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { formatAgentStatus } from "@/lib/agent-options";
import { authApi } from "@/lib/auth-api";

export default function PhoneNumberDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const phoneNumberId = params.id;
  const phoneNumber = useQuery({
    queryKey: ["phone-number", phoneNumberId],
    queryFn: () => authApi.phoneNumber(phoneNumberId),
  });
  const agents = useQuery({
    queryKey: ["agents", "phone-number-detail-options"],
    queryFn: () => authApi.agents({ limit: 100 }),
  });

  const assign = useMutation({
    mutationFn: (agentId: string) => authApi.assignPhoneNumberAgent(phoneNumberId, { agentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-number", phoneNumberId] });
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
    },
  });
  const unassign = useMutation({
    mutationFn: () => authApi.unassignPhoneNumber(phoneNumberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-number", phoneNumberId] });
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
    },
  });
  const enable = useMutation({
    mutationFn: () => authApi.enablePhoneNumber(phoneNumberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-number", phoneNumberId] });
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
    },
  });
  const disable = useMutation({
    mutationFn: () => authApi.disablePhoneNumber(phoneNumberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-number", phoneNumberId] });
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
    },
  });

  const number = phoneNumber.data;
  const activeAgents = agents.data?.data.filter((agent) => agent.status !== "INACTIVE") ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={number?.phoneNumber ?? "Phone Number"}
        description="Review routing metadata and prepare this number for incoming AI calls."
        action={
          <Button asChild variant="outline">
            <Link href="/voice/phone-numbers">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      {phoneNumber.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
        </div>
      ) : number ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-6">
            <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Phone Number Information</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {number.friendlyName ?? "Twilio number"}
                  </p>
                </div>
                <StatusBadge status={number.status} />
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Detail label="Phone Number" value={number.phoneNumber} />
                <Detail label="Country" value={number.countryCode ?? number.country ?? "Unknown"} />
                <Detail label="Area Code" value={number.areaCode ?? "Unknown"} />
                <Detail label="Provider" value={number.provider} />
                <Detail label="Purchase Source" value={number.purchaseSource ?? "Unknown"} />
                <Detail label="Twilio SID" value={number.twilioSid ?? "Not synced"} />
                <Detail label="Capabilities" value={formatCapabilities(number.capabilities)} />
                <Detail
                  label="Customer Price"
                  value={number.customerPrice ? `CA$${number.customerPrice.toFixed(2)}/mo` : "—"}
                />
                <Detail
                  label="Purchased"
                  value={
                    number.purchasedAt ? new Date(number.purchasedAt).toLocaleString() : "Not set"
                  }
                />
                <Detail label="Created" value={new Date(number.createdAt).toLocaleString()} />
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {number.status === "INACTIVE" ? (
                  <Button disabled={enable.isPending} onClick={() => enable.mutate()}>
                    Enable Number
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={disable.isPending}
                    onClick={() => disable.mutate()}
                  >
                    Disable Number
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-base font-semibold">Webhook Configuration</h2>
              <div className="mt-5 space-y-4">
                <WebhookRow label="Voice Webhook URL" value={number.voiceWebhookUrl} />
                <WebhookRow label="SMS Webhook URL" value={number.smsWebhookUrl} />
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-base font-semibold">Analytics Placeholder</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Metric label="Calls" value="0" />
                <Metric label="Duration" value="0s" />
                <Metric label="Leads" value="0" />
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-base font-semibold">Agent Assignment</h2>
              {number.agent ? (
                <div className="mt-5 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="font-medium">{number.agent.name}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {formatAgentStatus(number.agent.status)} · {number.agent.language}
                  </div>
                  <Button
                    className="mt-4"
                    variant="outline"
                    disabled={unassign.isPending}
                    onClick={() => unassign.mutate()}
                  >
                    Unassign
                  </Button>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState
                    icon={PhoneCall}
                    title="No agent assigned"
                    description="Assign an active agent before enabling incoming call routing."
                  />
                </div>
              )}
              <div className="mt-5 space-y-2">
                {activeAgents.map((agent) => (
                  <button
                    key={agent.id}
                    className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    onClick={() => assign.mutate(agent.id)}
                  >
                    <span>
                      <span className="block font-medium">{agent.name}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {formatAgentStatus(agent.status)} · {agent.language}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">{agent.voice}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-base font-semibold">Assignment History</h2>
              <p className="mt-3 text-sm text-zinc-500">
                Assignment history will populate after call routing and audit views are enabled.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <EmptyState
          icon={PhoneCall}
          title="Phone number not found"
          description="This number may have been removed or belongs to another workspace."
        />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium">{value}</p>
    </div>
  );
}

function WebhookRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-2 text-xs uppercase text-zinc-500">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 break-all text-sm font-medium">{value ?? "Not configured yet"}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PhoneNumberStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        status === "ACTIVE" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        status === "UNASSIGNED" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        status === "INACTIVE" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
      )}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatCapabilities(capabilities: { voice?: boolean; sms?: boolean; mms?: boolean }) {
  return (
    [
      capabilities.voice ? "Voice" : null,
      capabilities.sms ? "SMS" : null,
      capabilities.mms ? "MMS" : null,
    ]
      .filter(Boolean)
      .join(", ") || "None"
  );
}
