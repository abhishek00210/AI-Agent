"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentSummary, ProcessingStatus, UploadStatus } from "@ai-agent-platform/types";
import {
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ai-agent-platform/ui";
import { DocumentForm } from "@/components/knowledge-bases/document-form";
import { PdfUploadDropzone } from "@/components/knowledge-bases/pdf-upload-dropzone";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import {
  formatFileSize,
  formatProcessingStatus,
  formatUploadStatus,
  formatUploader,
  processingStatuses,
  uploadStatuses,
} from "@/lib/knowledge-base-options";
import { authApi } from "@/lib/auth-api";
import { useKnowledgeBaseStore } from "@/store/knowledge-base-store";

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const page = useKnowledgeBaseStore((state) => state.documentPage);
  const limit = useKnowledgeBaseStore((state) => state.documentLimit);
  const search = useKnowledgeBaseStore((state) => state.documentSearch);
  const uploadStatus = useKnowledgeBaseStore((state) => state.uploadStatus);
  const processingStatus = useKnowledgeBaseStore((state) => state.processingStatus);
  const setDocuments = useKnowledgeBaseStore((state) => state.setDocuments);
  const setPage = useKnowledgeBaseStore((state) => state.setDocumentPage);
  const setSearch = useKnowledgeBaseStore((state) => state.setDocumentSearch);
  const setUploadStatus = useKnowledgeBaseStore((state) => state.setUploadStatus);
  const setProcessingStatus = useKnowledgeBaseStore((state) => state.setProcessingStatus);
  const [searchInput, setSearchInput] = useState(search);
  const [documentModal, setDocumentModal] = useState<"create" | DocumentSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadKnowledgeBaseId, setUploadKnowledgeBaseId] = useState("");

  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases", "options"],
    queryFn: () => authApi.knowledgeBases({ limit: 100 }),
  });

  useEffect(() => {
    if (!uploadKnowledgeBaseId && knowledgeBasesQuery.data?.data[0]) {
      setUploadKnowledgeBaseId(knowledgeBasesQuery.data.data[0].id);
    }
  }, [knowledgeBasesQuery.data, uploadKnowledgeBaseId]);

  const query = useQuery({
    queryKey: ["documents", { page, limit, search, uploadStatus, processingStatus }],
    queryFn: async () => {
      const result = await authApi.documents({
        page,
        limit,
        search: search || undefined,
        uploadStatus: uploadStatus === "ALL" ? undefined : uploadStatus,
        processingStatus: processingStatus === "ALL" ? undefined : processingStatus,
      });
      setDocuments(result);
      return result;
    },
  });

  const createDocument = useMutation({
    mutationFn: authApi.createDocument,
    onSuccess: () => {
      setNotice("Document metadata created.");
      setDocumentModal(null);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    },
  });

  const updateDocument = useMutation({
    mutationFn: ({
      documentId,
      values,
    }: {
      documentId: string;
      values: Parameters<typeof authApi.updateDocument>[1];
    }) => authApi.updateDocument(documentId, values),
    onSuccess: () => {
      setNotice("Document metadata updated.");
      setDocumentModal(null);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: authApi.deleteDocument,
    onSuccess: () => {
      setNotice("Document metadata deleted.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    },
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage company documents used by your AI agents."
        action={
          <Button asChild>
            <a href="#upload-document">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </a>
          </Button>
        }
      />

      {notice ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
          <span>{notice}</span>
          <button className="text-xs font-medium" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section id="upload-document" className="scroll-mt-6 space-y-4">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Upload company document</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Select the knowledge base that should receive this PDF.
          </p>
          {knowledgeBasesQuery.isLoading ? (
            <SkeletonBlock className="mt-4 h-10 max-w-xl" />
          ) : knowledgeBasesQuery.data?.data.length ? (
            <select
              className="mt-4 h-10 w-full max-w-xl rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              value={uploadKnowledgeBaseId}
              onChange={(event) => setUploadKnowledgeBaseId(event.target.value)}
            >
              {knowledgeBasesQuery.data.data.map((knowledgeBase) => (
                <option key={knowledgeBase.id} value={knowledgeBase.id}>
                  {knowledgeBase.name}
                  {knowledgeBase.assignedAgent
                    ? ` — ${knowledgeBase.assignedAgent.name}`
                    : " — Unassigned"}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-amber-700 dark:text-amber-300">
              <span>Create a knowledge base before uploading a document.</span>
              <Button size="sm" variant="outline" asChild>
                <Link href="/knowledge-bases/create">Create Knowledge Base</Link>
              </Button>
            </div>
          )}
        </div>

        {uploadKnowledgeBaseId ? (
          <PdfUploadDropzone
            key={uploadKnowledgeBaseId}
            knowledgeBaseId={uploadKnowledgeBaseId}
            onUploaded={() => setNotice("PDF uploaded successfully.")}
          />
        ) : null}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <form className="relative w-full max-w-xl" onSubmit={applySearch}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Search documents"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={uploadStatus}
            onChange={(event) => setUploadStatus(event.target.value as UploadStatus | "ALL")}
          >
            <option value="ALL">All upload statuses</option>
            {uploadStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={processingStatus}
            onChange={(event) =>
              setProcessingStatus(event.target.value as ProcessingStatus | "ALL")
            }
          >
            <option value="ALL">All processing statuses</option>
            {processingStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {query.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {query.error instanceof Error ? query.error.message : "Unable to load documents."}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Document Name</th>
                <th className="px-6 py-3 font-medium">File Size</th>
                <th className="px-6 py-3 font-medium">Knowledge Base</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Upload Status</th>
                <th className="px-6 py-3 font-medium">Processing Status</th>
                <th className="px-6 py-3 font-medium">Uploaded By</th>
                <th className="px-6 py-3 font-medium">Created Date</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isLoading ? <DocumentTableSkeleton /> : null}
              {query.data?.data.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onEdit={() => setDocumentModal(document)}
                  onDelete={() => setDeleteTarget(document)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!query.isLoading && query.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Create metadata records and attach them to knowledge bases. Uploads arrive in a later phase."
              action={
                <Button onClick={() => setDocumentModal("create")}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create Document
                </Button>
              }
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-zinc-200 px-6 py-4 text-sm dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {documentModal ? (
        <DocumentModal
          title={documentModal === "create" ? "Create document metadata" : "Edit document metadata"}
          document={documentModal === "create" ? undefined : documentModal}
          knowledgeBases={knowledgeBasesQuery.data?.data ?? []}
          isSubmitting={createDocument.isPending || updateDocument.isPending}
          error={createDocument.error ?? updateDocument.error}
          onCancel={() => setDocumentModal(null)}
          onSubmit={(values) => {
            if (documentModal === "create") {
              createDocument.mutate({
                knowledgeBaseId: values.knowledgeBaseId,
                name: values.name,
                description: values.description,
              });
              return;
            }

            updateDocument.mutate({
              documentId: documentModal.id,
              values: {
                name: values.name,
                description: values.description,
                uploadStatus: values.uploadStatus,
                processingStatus: values.processingStatus,
              },
            });
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteDocumentDialog
          document={deleteTarget}
          isDeleting={deleteDocument.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteDocument.mutate(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function DocumentRow({
  document,
  onEdit,
  onDelete,
}: {
  document: DocumentSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  async function downloadDocument() {
    const access = await authApi.documentDownloadAccess(document.id);
    window.open(access.url, "_blank", "noopener,noreferrer");
  }

  return (
    <tr>
      <td className="px-6 py-4">
        <div className="font-medium">{document.name}</div>
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {formatFileSize(document.fileSize)}
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        <Link
          className="font-medium text-teal-700 hover:underline dark:text-teal-300"
          href={`/knowledge-bases/${document.knowledgeBaseId}`}
        >
          {document.knowledgeBase.name}
        </Link>
      </td>
      <td className="max-w-xs px-6 py-4 text-zinc-600 dark:text-zinc-300">
        <span className="line-clamp-2">{document.description ?? "No description"}</span>
      </td>
      <td className="px-6 py-4">
        <StatusBadge
          label={formatUploadStatus(document.uploadStatus)}
          tone={document.uploadStatus}
        />
      </td>
      <td className="px-6 py-4">
        <StatusBadge
          label={formatProcessingStatus(document.processingStatus)}
          tone={document.processingStatus}
        />
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {formatUploader(document.uploadedBy)}
      </td>
      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
        {new Date(document.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Document actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/documents/${document.id}`}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={document.uploadStatus !== "UPLOADED"}
              onClick={downloadDocument}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function DocumentModal({
  title,
  document,
  knowledgeBases,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  document?: DocumentSummary;
  knowledgeBases: Parameters<typeof DocumentForm>[0]["knowledgeBases"];
  isSubmitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: Parameters<typeof DocumentForm>[0]["onSubmit"];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Metadata only. Upload fields are placeholders for future ingestion.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error instanceof Error ? error.message : "Unable to save document metadata."}
          </div>
        ) : null}
        <DocumentForm
          document={document}
          knowledgeBases={knowledgeBases}
          submitLabel={document ? "Save Changes" : "Create Document"}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function ConfirmDeleteDocumentDialog({
  document,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  document: DocumentSummary;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Delete document metadata</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Are you sure you want to delete {document.name}?
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This soft deletes the metadata record and can be restored later.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentTableSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index}>
      {Array.from({ length: 9 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-6 py-4">
          <SkeletonBlock className="h-4 w-full" />
        </td>
      ))}
    </tr>
  ));
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        (tone === "COMPLETED" || tone === "UPLOADED") &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        (tone === "PENDING" || tone === "PROCESSING" || tone === "EMBEDDING") &&
          "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
        tone === "FAILED" && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      )}
    >
      {label}
    </span>
  );
}
