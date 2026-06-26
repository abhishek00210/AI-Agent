"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentSummary } from "@ai-agent-platform/types";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Globe2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ai-agent-platform/ui";
import { ChunkViewer } from "@/components/knowledge-bases/chunk-viewer";
import { DocumentForm } from "@/components/knowledge-bases/document-form";
import { EmbeddingOverview } from "@/components/knowledge-bases/embedding-overview";
import { PdfUploadDropzone } from "@/components/knowledge-bases/pdf-upload-dropzone";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader, SkeletonBlock } from "@/components/layout/page-loader";
import {
  formatKnowledgeBaseStatus,
  formatFileSize,
  formatProcessingStatus,
  formatUploadStatus,
  formatUploader,
} from "@/lib/knowledge-base-options";
import { authApi } from "@/lib/auth-api";
import { useEmbeddingStore } from "@/store/embedding-store";
import { useKnowledgeBaseStore } from "@/store/knowledge-base-store";

export default function KnowledgeBaseDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSelectedKnowledgeBase = useKnowledgeBaseStore((state) => state.setSelectedKnowledgeBase);
  const setDocuments = useKnowledgeBaseStore((state) => state.setDocuments);
  const setEmbeddingStats = useEmbeddingStore((state) => state.setStats);
  const [documentModal, setDocumentModal] = useState<"create" | DocumentSummary | null>(null);
  const [deleteDocumentTarget, setDeleteDocumentTarget] = useState<DocumentSummary | null>(null);
  const [deleteKnowledgeBaseOpen, setDeleteKnowledgeBaseOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const knowledgeBaseId = params.id;

  const knowledgeBaseQuery = useQuery({
    queryKey: ["knowledge-bases", knowledgeBaseId],
    queryFn: async () => {
      const knowledgeBase = await authApi.knowledgeBase(knowledgeBaseId);
      setSelectedKnowledgeBase(knowledgeBase);
      return knowledgeBase;
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["documents", { knowledgeBaseId }],
    queryFn: async () => {
      const result = await authApi.documents({ knowledgeBaseId, limit: 100 });
      setDocuments(result);
      return result;
    },
  });

  const websitesQuery = useQuery({
    queryKey: ["website-sources", { knowledgeBaseId, limit: 100 }],
    queryFn: () => authApi.websiteSources({ knowledgeBaseId, limit: 100 }),
  });

  const embeddingStatsQuery = useQuery({
    queryKey: ["embedding-stats", knowledgeBaseId],
    queryFn: async () => {
      const stats = await authApi.embeddingStats(knowledgeBaseId);
      setEmbeddingStats(stats);
      return stats;
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
      setDeleteDocumentTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    },
  });

  const deleteKnowledgeBase = useMutation({
    mutationFn: authApi.deleteKnowledgeBase,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      router.push("/knowledge-bases");
    },
  });

  if (knowledgeBaseQuery.isLoading) {
    return <PageLoader label="Loading knowledge base..." />;
  }

  if (knowledgeBaseQuery.error || !knowledgeBaseQuery.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {knowledgeBaseQuery.error instanceof Error
          ? knowledgeBaseQuery.error.message
          : "Knowledge base not found."}
      </div>
    );
  }

  const knowledgeBase = knowledgeBaseQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={knowledgeBase.name}
        description="Knowledge base details and document metadata are scoped to the current organization."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/knowledge-bases">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All Knowledge Bases
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/knowledge-bases/${knowledgeBase.id}/search`}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/knowledge-bases/${knowledgeBase.id}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </Button>
          </div>
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

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Knowledge base information</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <Detail label="Name" value={knowledgeBase.name} />
            <Detail label="Description" value={knowledgeBase.description ?? "No description"} />
            <Detail label="Status" value={formatKnowledgeBaseStatus(knowledgeBase.status)} />
            <Detail
              label="Assigned Agent"
              value={knowledgeBase.assignedAgent?.name ?? "Unassigned"}
            />
            <Detail label="Documents" value={String(knowledgeBase.documentsCount)} />
            <Detail
              label="Created Date"
              value={new Date(knowledgeBase.createdAt).toLocaleString()}
            />
            <Detail
              label="Updated Date"
              value={new Date(knowledgeBase.updatedAt).toLocaleString()}
            />
          </dl>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => setDeleteKnowledgeBaseOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Knowledge Base
          </Button>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <UploadCloud className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold">Document ingestion foundation</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            PDFs, websites, and FAQs can now be embedded and searched through the RAG engine.
          </p>
          <Button className="mt-6" variant="outline" asChild>
            <Link href={`/faqs/create?knowledgeBaseId=${knowledgeBase.id}`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add FAQ
            </Link>
          </Button>
        </div>
      </section>

      <PdfUploadDropzone
        knowledgeBaseId={knowledgeBase.id}
        onUploaded={() => setNotice("PDF uploaded successfully.")}
      />

      <EmbeddingOverview stats={embeddingStatsQuery.data} />

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Documents</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Uploaded PDFs and metadata records attached to this knowledge base.
            </p>
          </div>
          <Button onClick={() => setDocumentModal("create")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Document
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Document Name</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">File Size</th>
                <th className="px-6 py-3 font-medium">Upload Status</th>
                <th className="px-6 py-3 font-medium">Processing Status</th>
                <th className="px-6 py-3 font-medium">Uploaded By</th>
                <th className="px-6 py-3 font-medium">Created Date</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {documentsQuery.isLoading ? <DocumentTableSkeleton /> : null}
              {documentsQuery.data?.data.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onEdit={() => setDocumentModal(document)}
                  onDelete={() => setDeleteDocumentTarget(document)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!documentsQuery.isLoading && documentsQuery.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title="No documents added"
              description="Upload a PDF or create a metadata record for future ingestion."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setDocumentModal("create")}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Metadata
                  </Button>
                </div>
              }
            />
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Websites</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Scraped websites attached to this knowledge base.
            </p>
          </div>
          <Button asChild>
            <Link href="/website-sources/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Website
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">URL</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Words</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {websitesQuery.data?.data.map((website) => (
                <tr key={website.id}>
                  <td className="px-6 py-4 font-medium">{website.title ?? "Untitled website"}</td>
                  <td className="max-w-xs px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    <span className="block truncate">{website.url}</span>
                  </td>
                  <td className="px-6 py-4">{website.status}</td>
                  <td className="px-6 py-4">{website.content?.wordCount ?? 0}</td>
                  <td className="px-6 py-4">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/website-sources/${website.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!websitesQuery.isLoading && websitesQuery.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Globe2}
              title="No websites added"
              description="Add a website source to include scraped content in future retrieval."
            />
          </div>
        ) : null}
      </section>

      <ChunkViewer knowledgeBaseId={knowledgeBase.id} />

      {documentModal ? (
        <DocumentModal
          title={documentModal === "create" ? "Add document metadata" : "Edit document metadata"}
          document={documentModal === "create" ? undefined : documentModal}
          knowledgeBase={knowledgeBase}
          isSubmitting={createDocument.isPending || updateDocument.isPending}
          error={createDocument.error ?? updateDocument.error}
          onCancel={() => setDocumentModal(null)}
          onSubmit={(values) => {
            if (documentModal === "create") {
              createDocument.mutate({
                knowledgeBaseId,
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

      {deleteDocumentTarget ? (
        <ConfirmDialog
          title="Delete document metadata"
          message={`Are you sure you want to delete ${deleteDocumentTarget.name}?`}
          detail="This soft deletes the metadata record and can be restored later."
          isPending={deleteDocument.isPending}
          onCancel={() => setDeleteDocumentTarget(null)}
          onConfirm={() => deleteDocument.mutate(deleteDocumentTarget.id)}
        />
      ) : null}

      {deleteKnowledgeBaseOpen ? (
        <ConfirmDialog
          title="Delete knowledge base"
          message={`Are you sure you want to delete ${knowledgeBase.name}?`}
          detail="This soft deletes the repository and can be restored later."
          isPending={deleteKnowledgeBase.isPending}
          onCancel={() => setDeleteKnowledgeBaseOpen(false)}
          onConfirm={() => deleteKnowledgeBase.mutate(knowledgeBase.id)}
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
      <td className="max-w-sm px-6 py-4 text-zinc-600 dark:text-zinc-300">
        <span className="line-clamp-2">{document.description ?? "No description"}</span>
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {formatFileSize(document.fileSize)}
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
  knowledgeBase,
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  document?: DocumentSummary;
  knowledgeBase: NonNullable<Awaited<ReturnType<typeof authApi.knowledgeBase>>>;
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
          knowledgeBases={[knowledgeBase]}
          lockedKnowledgeBaseId={knowledgeBase.id}
          submitLabel={document ? "Save Changes" : "Create Document"}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  detail,
  isPending,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  detail: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{message}</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentTableSkeleton() {
  return Array.from({ length: 3 }).map((_, index) => (
    <tr key={index}>
      {Array.from({ length: 8 }).map((__, cellIndex) => (
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
