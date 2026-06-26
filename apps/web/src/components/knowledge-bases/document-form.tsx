"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CreateDocumentInput,
  DocumentDetails,
  KnowledgeBaseSummary,
  ProcessingStatus,
  UploadStatus,
} from "@ai-agent-platform/types";
import { Save } from "lucide-react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { processingStatuses, uploadStatuses } from "@/lib/knowledge-base-options";

const documentFormSchema = z.object({
  knowledgeBaseId: z.string().min(1, "Knowledge base is required."),
  name: z.string().trim().min(1, "Document name is required.").max(150, "Name is too long."),
  description: z.string().trim().max(500, "Description is too long.").optional(),
  uploadStatus: z.enum(["PENDING", "UPLOADED", "FAILED"]),
  processingStatus: z.enum(["PENDING", "PROCESSING", "EMBEDDING", "COMPLETED", "FAILED"]),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

export function DocumentForm({
  document,
  knowledgeBases,
  lockedKnowledgeBaseId,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  document?: DocumentDetails;
  knowledgeBases: KnowledgeBaseSummary[];
  lockedKnowledgeBaseId?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (
    values: CreateDocumentInput & {
      uploadStatus?: UploadStatus;
      processingStatus?: ProcessingStatus;
    },
  ) => void;
}) {
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      knowledgeBaseId: lockedKnowledgeBaseId ?? document?.knowledgeBaseId ?? "",
      name: document?.name ?? "",
      description: document?.description ?? "",
      uploadStatus: document?.uploadStatus ?? "PENDING",
      processingStatus: document?.processingStatus ?? "PENDING",
    },
  });

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          knowledgeBaseId: values.knowledgeBaseId,
          name: values.name,
          description: values.description?.trim() || undefined,
          uploadStatus: values.uploadStatus,
          processingStatus: values.processingStatus,
        }),
      )}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Knowledge Base" error={form.formState.errors.knowledgeBaseId?.message}>
          <select
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 disabled:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:disabled:bg-zinc-900"
            disabled={Boolean(lockedKnowledgeBaseId)}
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
        <Field label="Document Name" error={form.formState.errors.name?.message}>
          <input
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Pricing FAQ"
            {...form.register("name")}
          />
        </Field>
        <Field label="Upload Status" error={form.formState.errors.uploadStatus?.message}>
          <select
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            {...form.register("uploadStatus")}
          >
            {uploadStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Processing Status" error={form.formState.errors.processingStatus?.message}>
          <select
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            {...form.register("processingStatus")}
          >
            {processingStatuses.map((status) => (
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
          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="What this document will contain when uploads are enabled."
            {...form.register("description")}
          />
        </Field>
      </div>
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
