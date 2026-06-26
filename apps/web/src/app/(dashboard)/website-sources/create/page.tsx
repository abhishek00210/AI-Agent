"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { WebsiteSourceForm } from "@/components/website-sources/website-source-form";
import { authApi } from "@/lib/auth-api";

export default function CreateWebsiteSourcePage() {
  const router = useRouter();
  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases", "options"],
    queryFn: () => authApi.knowledgeBases({ limit: 100 }),
  });

  const createWebsiteSource = useMutation({
    mutationFn: authApi.createWebsiteSource,
    onSuccess: (websiteSource) => {
      router.push(`/website-sources/${websiteSource.id}`);
    },
  });

  if (knowledgeBasesQuery.isLoading) {
    return <PageLoader label="Loading knowledge bases..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Website"
        description="Queue a public website URL for readable content extraction."
        action={
          <Button variant="outline" asChild>
            <Link href="/website-sources">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All Websites
            </Link>
          </Button>
        }
      />

      {knowledgeBasesQuery.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {knowledgeBasesQuery.error instanceof Error
            ? knowledgeBasesQuery.error.message
            : "Unable to load knowledge bases."}
        </div>
      ) : null}

      {knowledgeBasesQuery.data?.data.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Create a knowledge base before adding website sources.
        </div>
      ) : null}

      <WebsiteSourceForm
        knowledgeBases={knowledgeBasesQuery.data?.data ?? []}
        submitLabel="Add Website"
        isSubmitting={createWebsiteSource.isPending}
        error={createWebsiteSource.error}
        onSubmit={(values) => createWebsiteSource.mutate(values)}
      />
    </div>
  );
}
