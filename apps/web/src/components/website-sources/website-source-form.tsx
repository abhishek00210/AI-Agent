"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { CreateWebsiteSourceInput, KnowledgeBaseSummary } from "@ai-agent-platform/types";
import { Globe2, Save } from "lucide-react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { formatUrlHost } from "@/lib/website-source-options";

const websiteSourceFormSchema = z.object({
  knowledgeBaseId: z.string().uuid("Select a knowledge base."),
  url: z
    .string()
    .trim()
    .min(1, "Website URL is required.")
    .url("Enter a valid website URL.")
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Only HTTP and HTTPS URLs are supported.",
    }),
});

type WebsiteSourceFormValues = z.infer<typeof websiteSourceFormSchema>;

export function WebsiteSourceForm({
  knowledgeBases,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
}: {
  knowledgeBases: KnowledgeBaseSummary[];
  submitLabel: string;
  isSubmitting?: boolean;
  error?: Error | null;
  onSubmit: (values: CreateWebsiteSourceInput) => void;
}) {
  const form = useForm<WebsiteSourceFormValues>({
    resolver: zodResolver(websiteSourceFormSchema),
    defaultValues: {
      knowledgeBaseId: "",
      url: "",
    },
  });
  const urlValue = form.watch("url");
  const hasUrlPreview = urlValue.trim().length > 0;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Website source</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Knowledge Base" error={form.formState.errors.knowledgeBaseId?.message}>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
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
          <Field label="Website URL" error={form.formState.errors.url?.message}>
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="https://example.com/docs"
              {...form.register("url")}
            />
          </Field>
        </div>

        <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2 font-medium">
            <Globe2 className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
            URL preview
          </div>
          <p className="mt-2 break-all text-zinc-500 dark:text-zinc-400">
            {hasUrlPreview ? formatUrlHost(urlValue) : "Enter a public website URL to preview it."}
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error.message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || knowledgeBases.length === 0}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Adding..." : submitLabel}
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
      {error ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </label>
  );
}
