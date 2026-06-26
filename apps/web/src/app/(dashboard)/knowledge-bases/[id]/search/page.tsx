"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { RagResults } from "@/components/knowledge-bases/rag-results";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useRagStore } from "@/store/rag-store";

export default function KnowledgeBaseSearchPage() {
  const { id } = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const searchResult = useRagStore((state) => state.searchResult);
  const setSearchResult = useRagStore((state) => state.setSearchResult);
  const knowledgeBase = useQuery({
    queryKey: ["knowledge-bases", id],
    queryFn: () => authApi.knowledgeBase(id),
  });
  const analytics = useQuery({
    queryKey: ["rag-analytics", id],
    queryFn: () => authApi.ragAnalytics(id),
  });
  const searchKnowledge = useMutation({
    mutationFn: authApi.searchKnowledgeBase,
    onSuccess: setSearchResult,
  });

  if (knowledgeBase.isLoading) {
    return <PageLoader label="Loading search..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Search"
        description={knowledgeBase.data?.name ?? "Search this knowledge base"}
        action={
          <Button variant="outline" asChild>
            <Link href={`/knowledge-bases/${id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Knowledge Base
            </Link>
          </Button>
        }
      />
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Searches" value={analytics.data?.totalSearches ?? 0} />
        <Stat label="Avg Time" value={`${analytics.data?.averageRetrievalTime ?? 0}ms`} />
        <Stat
          label="Avg Similarity"
          value={`${((analytics.data?.averageSimilarityScore ?? 0) * 100).toFixed(1)}%`}
        />
        <Stat label="Failed Retrievals" value={analytics.data?.failedRetrievals ?? 0} />
      </section>
      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) {
              searchKnowledge.mutate({ knowledgeBaseId: id, query: query.trim() });
            }
          }}
        >
          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Ask a question about PDFs, websites, and FAQs in this knowledge base."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={searchKnowledge.isPending || query.trim().length < 2}>
              <Search className="h-4 w-4" aria-hidden="true" />
              {searchKnowledge.isPending ? "Searching..." : "Search Knowledge"}
            </Button>
          </div>
        </form>
      </section>
      {searchKnowledge.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {searchKnowledge.error instanceof Error
            ? searchKnowledge.error.message
            : "Search failed."}
        </div>
      ) : null}
      {searchResult ? (
        <RagResults
          answer={searchResult.answer}
          confidence={searchResult.confidence}
          sources={searchResult.sources}
          chunks={searchResult.results}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
