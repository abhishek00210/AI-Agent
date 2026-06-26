"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, Loader2, Wrench } from "lucide-react";
import { Button, cn } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function ToolsPage() {
  const queryClient = useQueryClient();
  const tools = useQuery({
    queryKey: ["tools"],
    queryFn: () => authApi.tools(),
  });
  const stats = useQuery({
    queryKey: ["tools", "stats"],
    queryFn: () => authApi.toolStats(),
  });
  const executions = useQuery({
    queryKey: ["tools", "executions"],
    queryFn: () => authApi.toolExecutions({ limit: 12 }),
  });
  const updateTool = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      authApi.updateTool(name, { enabled }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tools"] }),
        queryClient.invalidateQueries({ queryKey: ["tools", "executions"] }),
        queryClient.invalidateQueries({ queryKey: ["tools", "stats"] }),
      ]);
    },
  });

  return (
    <>
      <PageHeader
        title="AI Actions"
        description="Manage safe business actions that agents can request through the tool registry."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Executions" value={stats.data?.total ?? 0} />
        <StatCard label="Success Rate" value={`${stats.data?.successRate ?? 0}%`} />
        <StatCard label="Failures" value={stats.data?.failed ?? 0} />
        <StatCard label="Rejected" value={stats.data?.rejected ?? 0} />
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Enabled Tools
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Disabled tools are omitted from OpenAI tool definitions and rejected at execution time.
          </p>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {tools.isLoading ? (
            <LoadingRow />
          ) : tools.data?.length ? (
            tools.data.map((tool) => (
              <div
                key={tool.id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <Wrench className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-zinc-950 dark:text-zinc-50">
                        {tool.displayName}
                      </h3>
                      <StatusBadge active={tool.enabled} />
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                      {tool.description}
                    </p>
                    <p className="mt-2 font-mono text-xs text-zinc-500">{tool.name}</p>
                  </div>
                </div>
                <Button
                  variant={tool.enabled ? "outline" : "default"}
                  disabled={updateTool.isPending}
                  onClick={() => updateTool.mutate({ name: tool.name, enabled: !tool.enabled })}
                >
                  {tool.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">
              No tools registered yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Recent Executions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/60">
              <tr>
                <th className="px-5 py-3 font-medium">Tool</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Conversation</th>
                <th className="px-5 py-3 font-medium">Call</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {executions.isLoading ? (
                <tr>
                  <td className="px-5 py-6 text-zinc-500" colSpan={5}>
                    Loading executions...
                  </td>
                </tr>
              ) : executions.data?.data.length ? (
                executions.data.data.map((execution) => (
                  <tr key={execution.id}>
                    <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                      {execution.toolName}
                    </td>
                    <td className="px-5 py-4">
                      <ExecutionBadge status={execution.status} />
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                      {execution.conversationId ?? "-"}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                      {execution.callId ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      {formatDate(execution.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-center text-zinc-500" colSpan={5}>
                    No tool executions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const Icon = active ? CheckCircle2 : CircleSlash;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
      )}
    >
      <Icon className="h-3 w-3" />
      {active ? "Enabled" : "Disabled"}
    </span>
  );
}

function ExecutionBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        status === "SUCCESS" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40",
        status === "FAILED" && "bg-rose-50 text-rose-700 dark:bg-rose-950/40",
        status === "REJECTED" && "bg-amber-50 text-amber-700 dark:bg-amber-950/40",
        (status === "PENDING" || status === "RUNNING") &&
          "bg-sky-50 text-sky-700 dark:bg-sky-950/40",
      )}
    >
      {status}
    </span>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-8 text-sm text-zinc-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading tools...
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
