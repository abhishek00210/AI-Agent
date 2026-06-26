"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { CreateFaqInput, FaqDetails, KnowledgeBaseSummary } from "@ai-agent-platform/types";
import { Save } from "lucide-react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";

const schema = z.object({
  knowledgeBaseId: z.string().uuid("Select a knowledge base."),
  question: z.string().trim().min(3, "Question must be at least 3 characters.").max(500),
  answer: z.string().trim().min(3, "Answer must be at least 3 characters.").max(10000),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type Values = z.infer<typeof schema>;

export function FaqForm({
  faq,
  knowledgeBases,
  fixedKnowledgeBaseId,
  isSubmitting,
  submitLabel,
  onSubmit,
}: {
  faq?: FaqDetails;
  knowledgeBases: KnowledgeBaseSummary[];
  fixedKnowledgeBaseId?: string;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: CreateFaqInput) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      knowledgeBaseId: fixedKnowledgeBaseId ?? faq?.knowledgeBaseId ?? "",
      question: faq?.question ?? "",
      answer: faq?.answer ?? "",
      status: faq?.status ?? "ACTIVE",
    },
  });

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">FAQ details</h2>
        <div className="mt-6 grid gap-5">
          <Field label="Knowledge Base" error={form.formState.errors.knowledgeBaseId?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
              disabled={Boolean(fixedKnowledgeBaseId || faq)}
              {...form.register("knowledgeBaseId")}
            >
              <option value="">Select knowledge base</option>
              {knowledgeBases.map((knowledgeBase) => (
                <option key={knowledgeBase.id} value={knowledgeBase.id}>
                  {knowledgeBase.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Question" error={form.formState.errors.question?.message}>
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="What are your business hours?"
              {...form.register("question")}
            />
          </Field>
          <Field label="Answer" error={form.formState.errors.answer?.message}>
            <textarea
              className="min-h-44 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="We are open Monday through Friday from 9 AM to 5 PM."
              {...form.register("answer")}
            />
          </Field>
          <Field label="Status" error={form.formState.errors.status?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              {...form.register("status")}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
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
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-2 block">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
