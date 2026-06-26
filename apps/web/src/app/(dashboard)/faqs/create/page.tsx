"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { FaqForm } from "@/components/knowledge-bases/faq-form";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function CreateFaqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fixedKnowledgeBaseId = searchParams.get("knowledgeBaseId") ?? undefined;
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases", "faq-options"],
    queryFn: () => authApi.knowledgeBases({ limit: 100 }),
  });
  const createFaq = useMutation({
    mutationFn: authApi.createFaq,
    onSuccess: (faq) => router.push(`/faqs/${faq.id}`),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create FAQ"
        description="The FAQ is embedded automatically and remains isolated to its organization."
        action={
          <Button variant="outline" asChild>
            <Link href="/faqs">
              <ArrowLeft className="h-4 w-4" /> FAQs
            </Link>
          </Button>
        }
      />
      {createFaq.error ? <ErrorNotice error={createFaq.error} /> : null}
      <FaqForm
        knowledgeBases={knowledgeBases.data?.data ?? []}
        fixedKnowledgeBaseId={fixedKnowledgeBaseId}
        submitLabel="Create FAQ"
        isSubmitting={createFaq.isPending}
        onSubmit={(values) => createFaq.mutate(values)}
      />
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error instanceof Error ? error.message : "Unable to create FAQ."}
    </div>
  );
}
