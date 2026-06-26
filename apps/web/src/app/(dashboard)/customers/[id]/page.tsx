"use client";
import type {
  CustomerLeadStatus,
  CustomerTimelineCategory,
  CustomerTimelineEvent,
} from "@ai-agent-platform/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import type React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function CustomerPage() {
  const id = useParams<{ id: string }>().id;
  const client = useQueryClient();
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => authApi.customer(id) });
  const timeline = useQuery({
    queryKey: ["customer", id, "timeline"],
    queryFn: () => authApi.customerTimeline(id, { limit: 20 }),
  });
  const summaries = useQuery({
    queryKey: ["customer", id, "summaries"],
    queryFn: () => authApi.customerSummaries(id, 10),
  });
  const automations = useQuery({
    queryKey: ["customer", id, "automations"],
    queryFn: () => authApi.automationExecutions(id),
  });
  const update = useMutation({
    mutationFn: (leadStatus: CustomerLeadStatus) => authApi.updateCustomer(id, { leadStatus }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["customer", id] }),
  });
  if (!customer.data) return <div className="h-96 animate-pulse bg-zinc-100 dark:bg-zinc-900" />;
  const value = customer.data;
  return (
    <div className="space-y-8">
      <PageHeader
        title={value.name}
        description={[value.phone, value.email, value.company].filter(Boolean).join(" · ")}
      />
      <section className="grid border-y border-zinc-200 py-5 dark:border-zinc-800 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Calls", value.totalCalls],
          ["Appointments", value.totalAppointments],
          ["Conversations", value.totalConversations],
          ["Messages", value.totalMessages],
          ["AI interactions", value.totalAiInteractions],
          ["First seen", date(value.firstSeenAt)],
        ].map(([label, metric]) => (
          <div key={label} className="px-4 py-2">
            <p className="text-xs uppercase text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-semibold">{metric}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <div>
            <label className="text-xs uppercase text-zinc-500">Lead status</label>
            <select
              className="mt-2 h-10 w-full border-b bg-transparent"
              value={value.leadStatus}
              onChange={(event) => update.mutate(event.target.value as CustomerLeadStatus)}
            >
              {["NEW", "CONTACTED", "QUALIFIED", "BOOKED", "CUSTOMER", "LOST"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
          <Info label="Phone" value={value.phone} />
          <Info label="Email" value={value.email} />
          <Info label="Company" value={value.company} />
          <Info label="Last contact" value={date(value.lastContactAt)} />
          <Info label="Notes" value={value.notes} />
        </aside>
        <main className="space-y-8">
          <Section title="Automations">
            {automations.data?.length ? (
              <div className="space-y-3">
                {automations.data.map((execution) => (
                  <div
                    key={execution.id}
                    className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{execution.workflow.name}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-900">
                        {execution.status}
                      </span>
                      <span className="ml-auto text-xs text-zinc-500">
                        {dateTime(execution.scheduledFor)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {execution.followUpReason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Muted />
            )}
          </Section>
          <Section title="AI summaries">
            {summaries.data?.length ? (
              <div className="space-y-4">
                {summaries.data.map((summary) => (
                  <article
                    key={summary.id}
                    className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        {summary.intent}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {summary.sentiment} · {summary.outcome.replaceAll("_", " ")}
                      </span>
                      <span className="ml-auto text-xs text-zinc-500">
                        {dateTime(summary.generatedAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {summary.summary}
                    </p>
                    {summary.nextAction ? (
                      <p className="mt-3 text-sm">
                        <span className="font-medium">Next action:</span> {summary.nextAction}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <Muted />
            )}
          </Section>
          <Section title="Activity feed">
            {timeline.data?.data.length ? (
              <div className="space-y-3">
                {timeline.data.data.map((event) => (
                  <TimelineRow key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <Muted />
            )}
          </Section>
          <Section title="Appointments">
            {value.contact?.appointments?.length ? (
              value.contact.appointments.map((item) => (
                <div key={item.id} className="flex justify-between border-b py-3 text-sm">
                  <span>{item.title}</span>
                  <span className="text-zinc-500">
                    {item.status} · {date(item.startTime)}
                  </span>
                </div>
              ))
            ) : (
              <Muted />
            )}
          </Section>
          <Section title="Communications">
            {value.contact?.communicationThreads?.length ? (
              value.contact.communicationThreads.map((thread) => (
                <div key={thread.id} className="flex justify-between border-b py-3 text-sm">
                  <span>{thread.channel}</span>
                  <span className="text-zinc-500">{thread.messages.length} recent messages</span>
                </div>
              ))
            ) : (
              <Muted />
            )}
          </Section>
        </main>
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-sm">{value || "—"}</p>
    </div>
  );
}
function TimelineRow({ event }: { event: CustomerTimelineEvent }) {
  return (
    <div className="grid grid-cols-[12px_1fr] gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <span className={`mt-1 h-3 w-3 rounded-full ${categoryColor(event.eventCategory)}`} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{event.title}</p>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            {event.eventCategory}
          </span>
          <span className="text-xs text-zinc-500">{dateTime(event.occurredAt)}</span>
        </div>
        {event.description ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{event.description}</p>
        ) : null}
        {event.sourceEntityType ? (
          <p className="mt-2 text-xs text-zinc-500">{event.sourceEntityType}</p>
        ) : null}
      </div>
    </div>
  );
}
function Muted() {
  return <p className="py-4 text-sm text-zinc-500">No activity yet.</p>;
}
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}
function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
function categoryColor(category: CustomerTimelineCategory) {
  return (
    {
      CUSTOMER: "bg-sky-500",
      VOICE: "bg-violet-500",
      SMS: "bg-emerald-500",
      EMAIL: "bg-amber-500",
      LEAD: "bg-pink-500",
      APPOINTMENT: "bg-blue-500",
      AI: "bg-fuchsia-500",
      SYSTEM: "bg-zinc-500",
    } as Record<CustomerTimelineCategory, string>
  )[category];
}
