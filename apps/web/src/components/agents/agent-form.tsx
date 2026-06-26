"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { AgentDetails, AgentStatus, CreateAgentInput } from "@ai-agent-platform/types";
import { Save } from "lucide-react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { agentLanguages, agentStatuses, agentVoices } from "@/lib/agent-options";

const agentFormSchema = z.object({
  name: z.string().trim().min(1, "Agent name is required.").max(100, "Name is too long."),
  description: z.string().trim().max(500, "Description is too long.").optional(),
  language: z.string().min(1, "Language is required."),
  voice: z.string().min(1, "Voice is required."),
  systemPrompt: z.string().trim().min(20, "System prompt must be at least 20 characters."),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

export function AgentForm({
  agent,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  agent?: AgentDetails;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: CreateAgentInput) => void;
}) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: agent?.name ?? "",
      description: agent?.description ?? "",
      language: agent?.language ?? "en-US",
      voice: agent?.voice ?? "alloy",
      systemPrompt: agent?.systemPrompt ?? "",
      status: agent?.status ?? "DRAFT",
    },
  });
  const promptValue = form.watch("systemPrompt") ?? "";

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          ...values,
          description: values.description?.trim() || undefined,
          status: values.status as AgentStatus,
        }),
      )}
    >
      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Agent details</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Agent Name" error={form.formState.errors.name?.message}>
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Reception Agent"
              {...form.register("name")}
            />
          </Field>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              {...form.register("status")}
            >
              {agentStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Description"
            error={form.formState.errors.description?.message}
            className="lg:col-span-2"
          >
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Handles inbound customer calls and appointment requests"
              {...form.register("description")}
            />
          </Field>
          <Field label="Language" error={form.formState.errors.language?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              {...form.register("language")}
            >
              {agentLanguages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Voice" error={form.formState.errors.voice?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              {...form.register("voice")}
            >
              {agentVoices.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">System prompt</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Define the agent personality, boundaries, and operating instructions.
            </p>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {promptValue.length} characters
          </span>
        </div>
        <textarea
          className="mt-5 min-h-56 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="You are a professional receptionist for our company. Answer politely and help customers book appointments."
          {...form.register("systemPrompt")}
        />
        {form.formState.errors.systemPrompt ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {form.formState.errors.systemPrompt.message}
          </p>
        ) : null}
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
