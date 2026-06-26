"use client";

import type {
  AutomationActionType,
  AutomationTriggerType,
  WorkflowBuilderConfiguration,
} from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, CheckCircle2, Clock3, Filter, Play, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function WorkflowBuilderPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}
    >
      <Builder />
    </Suspense>
  );
}

function Builder() {
  const templateId = useSearchParams().get("templateId");
  const router = useRouter();
  const template = useQuery({
    queryKey: ["workflow-template", templateId],
    queryFn: () => authApi.workflowTemplate(templateId!),
    enabled: Boolean(templateId),
  });
  const agents = useQuery({
    queryKey: ["agents", "workflow-builder"],
    queryFn: () => authApi.agents({ status: "ACTIVE", limit: 100 }),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configuration, setConfiguration] = useState<WorkflowBuilderConfiguration>({
    triggerType: "NEW_LEAD",
    delayMinutes: 1440,
    timing: "AFTER_TRIGGER",
    actionType: "SMS",
    messageTemplate: "",
    conditions: {},
    assignedAgentId: null,
  });
  useEffect(() => {
    if (!template.data) return;
    setName(template.data.name);
    setDescription(template.data.description ?? "");
    setConfiguration(
      template.data.configuration ??
        template.data.versions[0]?.configuration ??
        template.data.defaultConfiguration,
    );
  }, [template.data]);
  const activate = useMutation({
    mutationFn: async () => {
      if (templateId)
        return authApi.activateWorkflowTemplate(templateId, {
          name,
          description,
          ...configuration,
          enabled: true,
        });
      const workflow = await authApi.createAutomationWorkflow({
        name,
        description,
        configuration,
        enabled: true,
      });
      return { workflow, created: true };
    },
    onSuccess: () => router.push("/automations"),
  });
  return (
    <div className="space-y-7">
      <PageHeader
        title="Workflow Builder"
        description="Customize the four steps, then activate the workflow."
      />
      <div className="grid gap-7 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <Field label="Workflow name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-20 py-2`}
            />
          </Field>
          <Field label="Assigned agent">
            <select
              value={configuration.assignedAgentId ?? ""}
              onChange={(e) =>
                setConfiguration({ ...configuration, assignedAgentId: e.target.value || null })
              }
              className={inputClass}
            >
              <option value="">Any agent</option>
              {agents.data?.data.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </Field>
          <Button
            className="w-full"
            disabled={activate.isPending || !name.trim() || !configuration.messageTemplate.trim()}
            onClick={() => activate.mutate()}
          >
            <Play className="h-4 w-4" /> Activate workflow
          </Button>
          {activate.error ? <p className="text-sm text-red-600">{activate.error.message}</p> : null}
        </aside>
        <main className="mx-auto w-full max-w-3xl">
          <Step icon={Zap} label="Trigger" summary={configuration.triggerType.replaceAll("_", " ")}>
            <select
              value={configuration.triggerType}
              onChange={(e) =>
                setConfiguration({
                  ...configuration,
                  triggerType: e.target.value as AutomationTriggerType,
                })
              }
              className={inputClass}
            >
              {[
                "NEW_LEAD",
                "UPCOMING_APPOINTMENT",
                "APPOINTMENT_COMPLETED",
                "MISSED_APPOINTMENT",
                "NO_RESPONSE",
                "QUOTE_SENT",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Step>
          <Connector />
          <Step icon={Clock3} label="Delay" summary={`${configuration.delayMinutes} minutes`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                min={0}
                value={configuration.delayMinutes}
                onChange={(e) =>
                  setConfiguration({ ...configuration, delayMinutes: Number(e.target.value) })
                }
                className={inputClass}
              />
              <select
                value={configuration.timing}
                onChange={(e) =>
                  setConfiguration({
                    ...configuration,
                    timing: e.target.value as WorkflowBuilderConfiguration["timing"],
                  })
                }
                className={inputClass}
              >
                <option value="AFTER_TRIGGER">After trigger</option>
                <option value="BEFORE_EVENT">Before event</option>
              </select>
            </div>
          </Step>
          <Connector />
          <Step icon={Filter} label="Condition" summary={conditionLabel(configuration.conditions)}>
            <select
              value={conditionPreset(configuration.conditions)}
              onChange={(e) =>
                setConfiguration({ ...configuration, conditions: conditionsFor(e.target.value) })
              }
              className={inputClass}
            >
              <option value="NONE">Always run</option>
              <option value="NO_APPOINTMENT">No appointment booked</option>
              <option value="ACTIVE_LEAD">Lead is active</option>
              <option value="APPOINTMENT_ACTIVE">Appointment is confirmed or pending</option>
              <option value="APPOINTMENT_COMPLETED">Appointment is completed</option>
              <option value="MAX_THREE">Fewer than 3 previous follow-ups</option>
            </select>
          </Step>
          <Connector />
          <Step icon={CheckCircle2} label="Action" summary={configuration.actionType}>
            <div className="space-y-3">
              <select
                value={configuration.actionType}
                onChange={(e) =>
                  setConfiguration({
                    ...configuration,
                    actionType: e.target.value as AutomationActionType,
                  })
                }
                className={inputClass}
              >
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
                <option value="CALL">Call task</option>
              </select>
              {configuration.actionType === "EMAIL" ? (
                <input
                  placeholder="Email subject"
                  value={configuration.emailSubject ?? ""}
                  onChange={(e) =>
                    setConfiguration({ ...configuration, emailSubject: e.target.value })
                  }
                  className={inputClass}
                />
              ) : null}
              <textarea
                value={configuration.messageTemplate}
                onChange={(e) =>
                  setConfiguration({ ...configuration, messageTemplate: e.target.value })
                }
                className={`${inputClass} min-h-28 py-3`}
              />
              <p className="text-xs text-zinc-500">
                Variables: {"{{firstName}}"}, {"{{customerName}}"}, {"{{followUpReason}}"}
              </p>
            </div>
          </Step>
        </main>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-teal-500 dark:border-zinc-700";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
function Step({
  icon: Icon,
  label,
  summary,
  children,
}: {
  icon: typeof Zap;
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="font-semibold">{summary}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Connector() {
  return (
    <div className="flex h-12 items-center justify-center">
      <ArrowDown className="h-5 w-5 text-zinc-400" />
    </div>
  );
}
function conditionPreset(value: Record<string, unknown>) {
  if (value.noAppointmentBooked) return "NO_APPOINTMENT";
  if (value.leadStatuses) return "ACTIVE_LEAD";
  if (value.appointmentStatuses && (value.appointmentStatuses as string[]).includes("COMPLETED"))
    return "APPOINTMENT_COMPLETED";
  if (value.appointmentStatuses) return "APPOINTMENT_ACTIVE";
  if (value.maxPreviousFollowUps) return "MAX_THREE";
  return "NONE";
}
function conditionLabel(value: Record<string, unknown>) {
  return conditionPreset(value).replaceAll("_", " ").toLowerCase();
}
function conditionsFor(value: string): Record<string, unknown> {
  if (value === "NO_APPOINTMENT") return { noAppointmentBooked: true };
  if (value === "ACTIVE_LEAD") return { leadStatuses: ["NEW", "CONTACTED", "QUALIFIED"] };
  if (value === "APPOINTMENT_ACTIVE") return { appointmentStatuses: ["PENDING", "CONFIRMED"] };
  if (value === "APPOINTMENT_COMPLETED") return { appointmentStatuses: ["COMPLETED"] };
  if (value === "MAX_THREE") return { maxPreviousFollowUps: 3 };
  return {};
}
