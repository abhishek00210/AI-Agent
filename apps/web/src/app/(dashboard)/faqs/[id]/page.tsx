"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function FaqDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: ["faqs", id], queryFn: () => authApi.faq(id) });

  if (query.isLoading) return <PageLoader label="Loading FAQ..." />;
  if (!query.data || query.error) {
    return <div className="text-sm text-red-600">FAQ not found.</div>;
  }
  const faq = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQ details"
        description={faq.knowledgeBase?.name ?? "Tenant-scoped knowledge"}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/faqs">
                <ArrowLeft className="h-4 w-4" /> FAQs
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/faqs/${faq.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
          </div>
        }
      />
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Question</h2>
          <p className="mt-4 text-sm leading-6">{faq.question}</p>
          <dl className="mt-6 space-y-4 text-sm">
            <Detail label="Status" value={faq.status} />
            <Detail label="Created" value={new Date(faq.createdAt).toLocaleString()} />
            <Detail label="Updated" value={new Date(faq.updatedAt).toLocaleString()} />
          </dl>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Answer</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
            {faq.answer}
          </p>
        </div>
      </section>
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
