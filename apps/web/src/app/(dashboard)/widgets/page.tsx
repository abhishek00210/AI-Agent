"use client";

import type {
  CreateWidgetInput,
  WidgetDetails,
  WidgetPosition,
  WidgetStatus,
} from "@ai-agent-platform/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Code2, Copy, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { formatAgentStatus } from "@/lib/agent-options";
import { authApi } from "@/lib/auth-api";
import { webEnv } from "@/config/env";

const widgetSchema = z.object({
  name: z.string().min(2).max(100),
  agentId: z.string().uuid("Select an agent."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  position: z.enum(["BOTTOM_RIGHT", "BOTTOM_LEFT"]),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0f766e."),
  welcomeMessage: z.string().min(1).max(240),
});

type WidgetFormValues = z.infer<typeof widgetSchema>;

const defaultValues: WidgetFormValues = {
  name: "",
  agentId: "",
  status: "ACTIVE",
  position: "BOTTOM_RIGHT",
  primaryColor: "#0f766e",
  welcomeMessage: "Hi, how can I help?",
};

export default function WidgetsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<WidgetDetails | null>(null);
  const [installTarget, setInstallTarget] = useState<WidgetDetails | null>(null);
  const [copied, setCopied] = useState(false);

  const widgets = useQuery({
    queryKey: ["widgets"],
    queryFn: () => authApi.widgets(),
  });
  const agents = useQuery({
    queryKey: ["agents", "widget-options"],
    queryFn: () => authApi.agents({ limit: 100 }),
  });
  const activeAgents = useMemo(
    () => agents.data?.data.filter((agent) => agent.status !== "INACTIVE") ?? [],
    [agents.data?.data],
  );

  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetSchema),
    defaultValues,
  });

  const createWidget = useMutation({
    mutationFn: authApi.createWidget,
    onSuccess: (widget) => {
      form.reset(defaultValues);
      setInstallTarget(widget);
      void queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });

  const updateWidget = useMutation({
    mutationFn: (input: { widgetId: string; values: WidgetFormValues }) =>
      authApi.updateWidget(input.widgetId, input.values),
    onSuccess: (widget) => {
      setEditing(null);
      form.reset(defaultValues);
      setInstallTarget(widget);
      void queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });

  const deleteWidget = useMutation({
    mutationFn: authApi.deleteWidget,
    onSuccess: () => {
      setInstallTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["widgets"] });
    },
  });

  function submit(values: WidgetFormValues) {
    const input: CreateWidgetInput = values;
    if (editing) {
      updateWidget.mutate({ widgetId: editing.id, values });
      return;
    }
    createWidget.mutate(input);
  }

  function startEdit(widget: WidgetDetails) {
    setEditing(widget);
    form.reset({
      name: widget.name,
      agentId: widget.agentId,
      status: widget.status,
      position: widget.position,
      primaryColor: widget.primaryColor,
      welcomeMessage: widget.welcomeMessage,
    });
  }

  const installCode = installTarget ? buildInstallCode(installTarget) : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Widgets"
        description="Create embeddable chat widgets that connect visitors to tenant-scoped AI agents."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              form.reset(defaultValues);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Widget
          </Button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold">Widgets</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Each widget has its own public key and agent assignment.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Agent</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Position</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {widgets.isLoading ? <WidgetSkeleton /> : null}
                {widgets.data?.data.map((widget) => (
                  <tr key={widget.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{widget.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">{widget.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{widget.agent.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {formatAgentStatus(widget.agent.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={widget.status} />
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{formatPosition(widget.position)}</td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(widget.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(widget)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInstallTarget(widget)}
                        >
                          <Code2 className="h-4 w-4" aria-hidden="true" />
                          Install
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteWidget.isPending}
                          onClick={() => deleteWidget.mutate(widget.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!widgets.isLoading && widgets.data?.data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessageCircle}
                title="No widgets yet"
                description="Create a website widget to let visitors chat with an assigned AI agent."
              />
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <form
            className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
            onSubmit={form.handleSubmit(submit)}
          >
            <h2 className="text-base font-semibold">{editing ? "Edit Widget" : "Create Widget"}</h2>
            <div className="mt-5 space-y-4">
              <Field label="Widget Name" error={form.formState.errors.name?.message}>
                <input
                  className={inputClassName}
                  {...form.register("name")}
                  placeholder="Support Chat"
                />
              </Field>
              <Field label="Assigned Agent" error={form.formState.errors.agentId?.message}>
                <select className={inputClassName} {...form.register("agentId")}>
                  <option value="">Select agent</option>
                  {activeAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" error={form.formState.errors.status?.message}>
                  <select className={inputClassName} {...form.register("status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </Field>
                <Field label="Position" error={form.formState.errors.position?.message}>
                  <select className={inputClassName} {...form.register("position")}>
                    <option value="BOTTOM_RIGHT">Bottom Right</option>
                    <option value="BOTTOM_LEFT">Bottom Left</option>
                  </select>
                </Field>
              </div>
              <Field label="Primary Color" error={form.formState.errors.primaryColor?.message}>
                <div className="flex gap-2">
                  <input
                    className="h-10 w-12 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950"
                    type="color"
                    {...form.register("primaryColor")}
                  />
                  <input className={inputClassName} {...form.register("primaryColor")} />
                </div>
              </Field>
              <Field label="Welcome Message" error={form.formState.errors.welcomeMessage?.message}>
                <textarea
                  className={`${inputClassName} min-h-24 py-3`}
                  {...form.register("welcomeMessage")}
                />
              </Field>
            </div>
            {createWidget.error || updateWidget.error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {readError(createWidget.error ?? updateWidget.error, "Widget save failed.")}
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              {editing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    form.reset(defaultValues);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={createWidget.isPending || updateWidget.isPending}>
                {editing ? "Save Widget" : "Create Widget"}
              </Button>
            </div>
          </form>

          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold">Installation</h2>
            {installTarget ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-zinc-500">
                  Paste this snippet before the closing body tag on the customer website.
                </p>
                <pre className="max-h-56 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs leading-5 dark:border-zinc-800 dark:bg-zinc-900/40">
                  {installCode}
                </pre>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(installCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy Script"}
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                Select Install on a widget to view its script tag.
              </p>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}

const inputClassName =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <span className="mt-2 block">{children}</span>
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function StatusBadge({ status }: { status: WidgetStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        status === "ACTIVE" && "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
        status === "INACTIVE" && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      )}
    >
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

function WidgetSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index}>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-40" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-32" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-6 w-20" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-24" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-24" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-8 w-40" />
      </td>
    </tr>
  ));
}

function formatPosition(position: WidgetPosition) {
  return position === "BOTTOM_LEFT" ? "Bottom Left" : "Bottom Right";
}

function buildInstallCode(widget: WidgetDetails) {
  return `<script
  src="${webEnv.NEXT_PUBLIC_APP_URL}/widget.js"
  data-widget-id="${widget.id}"
  data-public-key="${widget.publicKey}"
  data-api-url="${webEnv.NEXT_PUBLIC_API_URL}/api/v1"
></script>`;
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
