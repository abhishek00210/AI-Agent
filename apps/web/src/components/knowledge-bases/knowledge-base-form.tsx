"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  AgentSummary,
  CreateKnowledgeBaseInput,
  KnowledgeBaseDetails,
  KnowledgeBaseStatus,
} from "@ai-agent-platform/types";
import { Save } from "lucide-react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { knowledgeBaseStatuses } from "@/lib/knowledge-base-options";

const knowledgeBaseFormSchema = z.object({
  name: z.string().trim().min(1, "Knowledge base name is required.").max(100, "Name is too long."),
  description: z.string().trim().max(500, "Description is too long.").optional(),
  agentId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
});

type KnowledgeBaseFormValues = z.infer<typeof knowledgeBaseFormSchema>;

export function KnowledgeBaseForm({
  knowledgeBase,
  agents,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  knowledgeBase?: KnowledgeBaseDetails;
  agents: AgentSummary[];
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: CreateKnowledgeBaseInput) => void;
}) {
  const form = useForm<KnowledgeBaseFormValues>({
    resolver: zodResolver(knowledgeBaseFormSchema),
    defaultValues: {
      name: knowledgeBase?.name ?? "",
      description: knowledgeBase?.description ?? "",
      agentId: knowledgeBase?.agentId ?? "",
      status: knowledgeBase?.status ?? "DRAFT",
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          name: values.name,
          description: values.description?.trim() || undefined,
          agentId: values.agentId || null,
          status: values.status as KnowledgeBaseStatus,
        }),
      )}
    >
      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Knowledge base details</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Knowledge Base Name" error={form.formState.errors.name?.message}>
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Reception knowledge"
              {...form.register("name")}
            />
          </Field>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              {...form.register("status")}
            >
              {knowledgeBaseStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assign Agent" error={form.formState.errors.agentId?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              {...form.register("agentId")}
            >
              <option value="">No agent assigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Description"
            error={form.formState.errors.description?.message}
            className="lg:col-span-2"
          >
            <textarea
              className="min-h-32 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Documents and reference material for reception workflows."
              {...form.register("description")}
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium ${className ?? ""}`}>
      <span className="mb-2 block">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </label>
  );
}
