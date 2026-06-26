"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, ScanSearch, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { EmbeddingStatusCard } from "@/components/knowledge-bases/embedding-status-card";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import {
  formatFileSize,
  formatProcessingStatus,
  formatUploadStatus,
  formatUploader,
} from "@/lib/knowledge-base-options";
import { useEmbeddingStore } from "@/store/embedding-store";
import { useKnowledgeBaseStore } from "@/store/knowledge-base-store";

export default function DocumentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const documentId = params.id;
  const setSelectedDocument = useKnowledgeBaseStore((state) => state.setSelectedDocument);
  const setSourceStatus = useEmbeddingStore((state) => state.setSourceStatus);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    queryFn: async () => {
      const document = await authApi.document(documentId);
      setSelectedDocument(document);
      return document;
    },
  });

  const downloadDocument = useMutation({
    mutationFn: authApi.documentDownloadAccess,
    onSuccess: (access) => {
      window.open(access.url, "_blank", "noopener,noreferrer");
    },
  });

  const embeddingStatusQuery = useQuery({
    queryKey: ["embedding-status", documentId],
    queryFn: async () => {
      const status = await authApi.embeddingStatus(documentId);
      setSourceStatus(status);
      return status;
    },
    refetchInterval: (queryResult) => {
      const status = queryResult.state.data?.status;
      return status === "PROCESSING" || status === "EMBEDDING" ? 3000 : false;
    },
  });

  const processEmbeddings = useMutation({
    mutationFn: authApi.processDocumentEmbeddings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["embedding-status", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
      void queryClient.invalidateQueries({ queryKey: ["embedding-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["embedding-chunks"] });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: authApi.deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      router.push("/documents");
    },
  });

  if (documentQuery.isLoading) {
    return <PageLoader label="Loading document..." />;
  }

  if (documentQuery.error || !documentQuery.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {documentQuery.error instanceof Error ? documentQuery.error.message : "Document not found."}
      </div>
    );
  }

  const document = documentQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={document.name}
        description="Document metadata and file access are scoped to the current organization."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/documents">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All Documents
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={document.uploadStatus !== "UPLOADED" || downloadDocument.isPending}
              onClick={() => downloadDocument.mutate(document.id)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloadDocument.isPending ? "Preparing..." : "Download"}
            </Button>
          </div>
        }
      />

      {downloadDocument.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {downloadDocument.error instanceof Error
            ? downloadDocument.error.message
            : "Unable to prepare download."}
        </div>
      ) : null}

      {processEmbeddings.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {processEmbeddings.error.message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Document metadata</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <Detail label="Name" value={document.name} />
            <Detail
              label="Original Filename"
              value={document.originalFileName ?? document.fileName ?? "Metadata only"}
            />
            <Detail label="File Type" value={document.fileType ?? "No file uploaded"} />
            <Detail label="File Size" value={formatFileSize(document.fileSize)} />
            <Detail label="Knowledge Base" value={document.knowledgeBase.name} />
            <Detail label="Upload Status" value={formatUploadStatus(document.uploadStatus)} />
            <Detail
              label="Processing Status"
              value={formatProcessingStatus(document.processingStatus)}
            />
            <Detail label="Uploaded By" value={formatUploader(document.uploadedBy)} />
            <Detail label="Created Date" value={new Date(document.createdAt).toLocaleString()} />
            <Detail label="Updated Date" value={new Date(document.updatedAt).toLocaleString()} />
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/knowledge-bases/${document.knowledgeBaseId}`}>
                <FileText className="h-4 w-4" aria-hidden="true" />
                Knowledge Base
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <ScanSearch className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold">PDF preview placeholder</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            File storage, secure download, extraction, chunking, and embeddings are ready. Inline
            PDF preview, OCR, and retrieval are intentionally reserved for later phases.
          </p>
          <div className="mt-6 flex min-h-72 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <div>
              <FileText
                className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium">Preview not enabled yet</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Download the file to inspect uploaded PDFs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <EmbeddingStatusCard
        status={embeddingStatusQuery.data}
        isProcessing={processEmbeddings.isPending}
        onProcess={() => processEmbeddings.mutate(document.id)}
      />

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold">Delete document</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Are you sure you want to delete {document.name}?
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              This removes the stored file when present and soft deletes the metadata record.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={deleteDocument.isPending}
                onClick={() => deleteDocument.mutate(document.id)}
              >
                {deleteDocument.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
