"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { KnowledgeBaseForm } from "@/components/knowledge-bases/knowledge-base-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function EditKnowledgeBasePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const knowledgeBaseId = params.id;

  const knowledgeBaseQuery = useQuery({
    queryKey: ["knowledge-bases", knowledgeBaseId],
    queryFn: () => authApi.knowledgeBase(knowledgeBaseId),
  });

  const agentsQuery = useQuery({
    queryKey: ["agents", "options"],
    queryFn: () => authApi.agents({ limit: 100 }),
  });

  const updateKnowledgeBase = useMutation({
    mutationFn: (values: Parameters<typeof authApi.updateKnowledgeBase>[1]) =>
      authApi.updateKnowledgeBase(knowledgeBaseId, values),
    onSuccess: (knowledgeBase) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      router.push(`/knowledge-bases/${knowledgeBase.id}`);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${knowledgeBaseQuery.data.name}`}
        description="Update repository metadata and optional agent assignment."
        action={
          <Button variant="outline" asChild>
            <Link href={`/knowledge-bases/${knowledgeBaseId}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Details
            </Link>
          </Button>
        }
      />

      {updateKnowledgeBase.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {updateKnowledgeBase.error instanceof Error
            ? updateKnowledgeBase.error.message
            : "Unable to update knowledge base."}
        </div>
      ) : null}

      <KnowledgeBaseForm
        knowledgeBase={knowledgeBaseQuery.data}
        agents={agentsQuery.data?.data ?? []}
        submitLabel="Save Changes"
        isSubmitting={updateKnowledgeBase.isPending}
        onSubmit={(values) => updateKnowledgeBase.mutate(values)}
      />
    </div>
  );
}
