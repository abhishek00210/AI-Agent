"use client";

import type { OutboundCall, OutboundCallStatus } from "@ai-agent-platform/types";
import { Button, cn } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, PhoneCall, Timer, Voicemail } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

const statuses: Array<"ALL" | OutboundCallStatus> = [
  "ALL",
  "PENDING",
  "SCHEDULED",
  "DIALING",
  "RINGING",
  "IN_PROGRESS",
  "COMPLETED",
  "BUSY",
  "NO_ANSWER",
  "VOICEMAIL",
  "FAILED",
  "CANCELLED",
];

export default function OutboundCallsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"ALL" | OutboundCallStatus>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [customerProfileId, setCustomerProfileId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [reasonDescription, setReasonDescription] = useState("Customer follow-up call.");
  const query = useQuery({
    queryKey: ["outbound-calls", status],
    queryFn: () => authApi.outboundCalls({ status: status === "ALL" ? undefined : status, limit: 100 }),
  });
  const calls = query.data ?? [];
  const customers = useQuery({
    queryKey: ["customers", "outbound-call-options"],
    queryFn: () => authApi.customers(),
    enabled: showCreate,
  });
  const agents = useQuery({
    queryKey: ["agents", "outbound-call-options"],
    queryFn: () => authApi.agents({ status: "ACTIVE", limit: 100 }),
    enabled: showCreate,
  });
  const createCall = useMutation({
    mutationFn: () =>
      authApi.createOutboundCall({
        customerProfileId,
        agentId,
        reasonType: "MANUAL_CALL",
        reasonDescription,
      }),
    onSuccess: async () => {
      setShowCreate(false);
      setCustomerProfileId("");
      setAgentId("");
      await queryClient.invalidateQueries({ queryKey: ["outbound-calls"] });
    },
  });
  const connected = calls.filter((call) => ["IN_PROGRESS", "COMPLETED"].includes(call.status)).length;
  const qualified = calls.filter((call) => call.qualified).length;
  const booked = calls.filter((call) => call.appointmentBooked).length;
  const voicemail = calls.filter((call) => call.status === "VOICEMAIL").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound AI calls"
        description="Create and monitor one-to-one AI calls, including workflow follow-ups."
        action={<Button onClick={() => setShowCreate((value) => !value)}>New outbound call</Button>}
      />

      {showCreate ? (
        <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Customer</span>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={customerProfileId}
              onChange={(event) => setCustomerProfileId(event.target.value)}
            >
              <option value="">Select customer</option>
              {(customers.data ?? []).filter((customer) => customer.phone).map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">AI agent</span>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
            >
              <option value="">Select agent</option>
              {(agents.data?.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Call reason</span>
            <input
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              value={reasonDescription}
              maxLength={500}
              onChange={(event) => setReasonDescription(event.target.value)}
            />
          </label>
          <div className="flex items-center gap-2 md:col-span-3">
            <Button
              disabled={!customerProfileId || !agentId || !reasonDescription.trim() || createCall.isPending}
              onClick={() => createCall.mutate()}
            >
              {createCall.isPending ? "Starting…" : "Start AI call"}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            {createCall.error ? <p className="text-sm text-red-600">{createCall.error.message}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={PhoneCall} label="Attempts" value={calls.length} />
        <Metric icon={CheckCircle2} label="Connected" value={connected} />
        <Metric icon={CalendarCheck} label="Appointments" value={booked} />
        <Metric icon={Voicemail} label="Voicemail" value={voicemail} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">Qualification attempts</h2>
            <p className="text-sm text-zinc-500">
              Qualification rate: {calls.length ? ((qualified / calls.length) * 100).toFixed(1) : "0.0"}%
            </p>
          </div>
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | OutboundCallStatus)}
          >
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All statuses" : format(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.2fr_140px_1fr_1fr_120px_160px] border-b border-zinc-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <span>Customer / lead</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Agent</span>
              <span>Duration</span>
              <span>Outcome</span>
            </div>
            {calls.map((call) => (
              <OutboundCallRow key={call.id} call={call} />
            ))}
            {!query.isLoading && calls.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">No outbound AI calls yet.</p>
            ) : null}
            {query.isLoading ? (
              <p className="p-8 text-center text-sm text-zinc-500">Loading outbound calls…</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function OutboundCallRow({ call }: { call: OutboundCall }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => authApi.cancelOutboundCall(call.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outbound-calls"] }),
  });
  const canCancel = ["PENDING", "SCHEDULED", "DIALING", "RINGING", "IN_PROGRESS"].includes(call.status);
  return (
    <div className="grid grid-cols-[1.2fr_140px_1fr_1fr_120px_160px] items-center gap-3 border-b border-zinc-100 px-4 py-4 text-sm last:border-0 dark:border-zinc-900">
      <div>
        <p className="font-medium">{call.customer.name}</p>
        <p className="text-xs text-zinc-500">{call.customer.phone ?? call.customer.email ?? "No contact"}</p>
      </div>
      <Pill tone={statusTone(call.status)}>{format(call.status)}</Pill>
      <div>
        <p className="font-medium">{format(call.reasonType)}</p>
        <p className="line-clamp-1 text-xs text-zinc-500">{call.reasonDescription}</p>
      </div>
      <p>{call.agent.name}</p>
      <p className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
        <Timer className="h-3.5 w-3.5" />
        {call.durationSeconds ? `${call.durationSeconds}s` : "—"}
      </p>
      <div className="flex items-center gap-2">
        <Pill tone={call.qualified ? "success" : "neutral"}>
          {call.qualified ? "Qualified" : "Not qualified"}
        </Pill>
        {call.callId ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/voice/calls/${call.callId}`}>Call</Link>
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "success" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        tone === "danger" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        tone === "neutral" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
      )}
    >
      {children}
    </span>
  );
}

function statusTone(status: OutboundCallStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "COMPLETED") return "success";
  if (["DIALING", "RINGING", "IN_PROGRESS", "PENDING", "SCHEDULED"].includes(status)) return "warning";
  if (["FAILED", "BUSY", "NO_ANSWER", "VOICEMAIL", "CANCELLED"].includes(status)) return "danger";
  return "neutral";
}

function format(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
