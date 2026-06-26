"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { FaqForm } from "@/components/knowledge-bases/faq-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function EditFaqPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const faq = useQuery({ queryKey: ["faqs", id], queryFn: () => authApi.faq(id) });
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases", "faq-options"],
    queryFn: () => authApi.knowledgeBases({ limit: 100 }),
  });
  const updateFaq = useMutation({
    mutationFn: (values: Parameters<typeof authApi.updateFaq>[1]) => authApi.updateFaq(id, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["faqs"] });
      router.push(`/faqs/${id}`);
    },
  });

  if (faq.isLoading) return <PageLoader label="Loading FAQ..." />;
  if (!faq.data) return <div className="text-sm text-red-600">FAQ not found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit FAQ"
        description="Saving an active FAQ regenerates its tenant-scoped embedding."
        action={
          <Button variant="outline" asChild>
            <Link href={`/faqs/${id}`}>
              <ArrowLeft className="h-4 w-4" /> FAQ details
            </Link>
          </Button>
        }
      />
      {updateFaq.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {updateFaq.error.message}
        </div>
      ) : null}
      <FaqForm
        faq={faq.data}
        knowledgeBases={knowledgeBases.data?.data ?? []}
        submitLabel="Save FAQ"
        isSubmitting={updateFaq.isPending}
        onSubmit={({ question, answer, status }) => updateFaq.mutate({ question, answer, status })}
      />
    </div>
  );
}
