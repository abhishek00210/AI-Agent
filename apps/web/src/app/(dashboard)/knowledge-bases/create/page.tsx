"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { KnowledgeBaseForm } from "@/components/knowledge-bases/knowledge-base-form";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function CreateKnowledgeBasePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const agentsQuery = useQuery({
    queryKey: ["agents", "options"],
    queryFn: () => authApi.agents({ limit: 100 }),
  });

  const createKnowledgeBase = useMutation({
    mutationFn: authApi.createKnowledgeBase,
    onSuccess: (knowledgeBase) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      router.push(`/knowledge-bases/${knowledgeBase.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Knowledge Base"
        description="Create a tenant-scoped repository for future document ingestion and retrieval."
        action={
          <Button variant="outline" asChild>
            <Link href="/knowledge-bases">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Knowledge Bases
            </Link>
          </Button>
        }
      />

      {createKnowledgeBase.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {createKnowledgeBase.error instanceof Error
            ? createKnowledgeBase.error.message
            : "Unable to create knowledge base."}
        </div>
      ) : null}

      <KnowledgeBaseForm
        agents={agentsQuery.data?.data ?? []}
        submitLabel="Create Knowledge Base"
        isSubmitting={createKnowledgeBase.isPending}
        onSubmit={(values) => createKnowledgeBase.mutate(values)}
      />
    </div>
  );
}
