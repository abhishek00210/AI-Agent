"use client";

import type {
  AutomationExecution,
  AutomationRule,
  AutomationWorkflow,
} from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, MessageSquareText, PhoneCall, Workflow } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function AutomationsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["automations"], queryFn: authApi.automations });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      authApi.updateAutomationWorkflow(id, { enabled }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["automations"] }),
  });
  const updateRule = useMutation({
    mutationFn: ({ id, delayMinutes }: { id: string; delayMinutes: number }) =>
      authApi.updateAutomationRule(id, { delayMinutes }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["automations"] }),
  });
  const updateTemplate = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      authApi.updateAutomationTemplate(id, { body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["automations"] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => authApi.cancelAutomation(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["automations"] }),
  });
  const data = query.data;
  return (
    <div className="space-y-7">
      <PageHeader
        title="Follow-up automations"
        description="Event-driven follow-ups that run in the background through durable queues."
        action={
          <Button asChild>
            <Link href="/automations/templates">Browse templates</Link>
          </Button>
        }
      />
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Pending" value={data?.metrics.pending ?? 0} />
        <Metric label="Completed" value={data?.metrics.completed ?? 0} />
        <Metric label="Failed" value={data?.metrics.failed ?? 0} />
        <Metric label="Success rate" value={`${(data?.metrics.successRate ?? 0).toFixed(1)}%`} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Workflows</h2>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {data?.workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onToggle={(enabled) => toggle.mutate({ id: workflow.id, enabled })}
              onDelay={(rule, delayMinutes) => updateRule.mutate({ id: rule.id, delayMinutes })}
              onTemplate={(id, body) => updateTemplate.mutate({ id, body })}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Execution history</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1fr_130px_170px_150px] border-b px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span>Follow-up reason</span>
              <span>Action</span>
              <span>Scheduled</span>
              <span>Status</span>
            </div>
            {data?.executions.map((execution) => (
              <ExecutionRow
                key={execution.id}
                execution={execution}
                onCancel={() => cancel.mutate(execution.id)}
              />
            ))}
            {!query.isLoading && !data?.executions.length ? (
              <p className="p-8 text-center text-sm text-zinc-500">No automation executions yet.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkflowCard({
  workflow,
  onToggle,
  onDelay,
  onTemplate,
}: {
  workflow: AutomationWorkflow;
  onToggle(enabled: boolean): void;
  onDelay(rule: AutomationRule, delay: number): void;
  onTemplate(id: string, body: string): void;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-teal-600" />
            <h3 className="font-semibold">{workflow.name}</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{workflow.description}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Trigger · {workflow.triggerType.replaceAll("_", " ")}
          </p>
        </div>
        <Button
          size="sm"
          variant={workflow.enabled ? "default" : "outline"}
          onClick={() => onToggle(!workflow.enabled)}
        >
          {workflow.enabled ? "Enabled" : "Paused"}
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {workflow.rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900"
          >
            <ActionIcon action={rule.actionType} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {rule.actionType} · {rule.template?.name ?? "Default template"}
              </p>
              {rule.template ? (
                <textarea
                  aria-label={`${workflow.name} template`}
                  className="mt-1 min-h-14 w-full resize-y rounded border border-zinc-200 bg-transparent p-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  defaultValue={rule.template.body}
                  onBlur={(event) => {
                    const body = event.target.value.trim();
                    if (body && body !== rule.template?.body) onTemplate(rule.template!.id, body);
                  }}
                />
              ) : (
                <p className="text-xs text-zinc-500">Default template</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock3 className="h-3.5 w-3.5" />
              <input
                className="w-20 rounded border bg-transparent px-2 py-1 text-right"
                type="number"
                min={0}
                defaultValue={rule.delayMinutes}
                onBlur={(event) => onDelay(rule, Number(event.target.value))}
              />{" "}
              min
            </label>
          </div>
        ))}
      </div>
    </article>
  );
}
function ExecutionRow({
  execution,
  onCancel,
}: {
  execution: AutomationExecution;
  onCancel(): void;
}) {
  const cancellable = execution.status === "PENDING" || execution.status === "SCHEDULED";
  return (
    <div className="grid grid-cols-[1fr_130px_170px_150px] items-center border-b px-4 py-4 text-sm last:border-b-0 dark:border-zinc-800">
      <div className="min-w-0 pr-5">
        <p className="truncate font-medium">{execution.followUpReason}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {execution.customerProfile.name} · {execution.workflow.name}
        </p>
      </div>
      <span>{execution.actionType}</span>
      <span className="text-xs text-zinc-500">
        {new Date(execution.scheduledFor).toLocaleString()}
      </span>
      <div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
          {execution.status}
        </span>
        {cancellable ? (
          <button className="ml-2 text-xs text-red-600" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
function ActionIcon({ action }: { action: string }) {
  return action === "CALL" ? (
    <PhoneCall className="h-4 w-4" />
  ) : (
    <MessageSquareText className="h-4 w-4" />
  );
}
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
