"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { PdfUploadDropzone } from "@/components/knowledge-bases/pdf-upload-dropzone";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function KnowledgeDocumentsPage() {
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");

  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases", "document-upload-options"],
    queryFn: () => authApi.knowledgeBases({ limit: 100 }),
  });

  useEffect(() => {
    if (!knowledgeBaseId && knowledgeBasesQuery.data?.data[0]) {
      setKnowledgeBaseId(knowledgeBasesQuery.data.data[0].id);
    }
  }, [knowledgeBaseId, knowledgeBasesQuery.data]);

  const selectedKnowledgeBase = knowledgeBasesQuery.data?.data.find(
    (knowledgeBase) => knowledgeBase.id === knowledgeBaseId,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Company Documents"
        description="Upload company information as a PDF so your AI agents can retrieve it during conversations."
        action={
          <Button variant="outline" asChild>
            <Link href="/documents">
              <FileText className="h-4 w-4" aria-hidden="true" />
              View Documents
            </Link>
          </Button>
        }
      />

      {knowledgeBasesQuery.isLoading ? <SkeletonBlock className="h-32" /> : null}

      {knowledgeBasesQuery.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {knowledgeBasesQuery.error instanceof Error
            ? knowledgeBasesQuery.error.message
            : "Unable to load knowledge bases."}
        </div>
      ) : null}

      {!knowledgeBasesQuery.isLoading && knowledgeBasesQuery.data?.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Create a knowledge base first"
          description="Documents need a knowledge base so they can be assigned to the correct AI agent."
          action={
            <Button asChild>
              <Link href="/knowledge-bases/create">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Knowledge Base
              </Link>
            </Button>
          }
        />
      ) : null}

      {knowledgeBasesQuery.data?.data.length ? (
        <>
          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <label className="block max-w-xl text-sm font-medium" htmlFor="upload-knowledge-base">
              Knowledge Base
            </label>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Choose which knowledge base and agent should use this company document.
            </p>
            <select
              id="upload-knowledge-base"
              className="mt-4 h-10 w-full max-w-xl rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              value={knowledgeBaseId}
              onChange={(event) => setKnowledgeBaseId(event.target.value)}
            >
              {knowledgeBasesQuery.data.data.map((knowledgeBase) => (
                <option key={knowledgeBase.id} value={knowledgeBase.id}>
                  {knowledgeBase.name}
                  {knowledgeBase.assignedAgent ? ` — ${knowledgeBase.assignedAgent.name}` : " — Unassigned"}
                </option>
              ))}
            </select>
            {selectedKnowledgeBase && !selectedKnowledgeBase.assignedAgent ? (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                This knowledge base is not assigned to an agent yet. Assign it before testing calls.
              </p>
            ) : null}
          </section>

          <PdfUploadDropzone key={knowledgeBaseId} knowledgeBaseId={knowledgeBaseId} />

          {selectedKnowledgeBase ? (
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <Link href={`/knowledge-bases/${selectedKnowledgeBase.id}`}>
                  Manage {selectedKnowledgeBase.name}
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
