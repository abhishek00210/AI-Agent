"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Globe2, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmbeddingStatusCard } from "@/components/knowledge-bases/embedding-status-card";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import {
  formatDateTime,
  formatWebsiteSourceStatus,
  websiteSourceStatusTone,
} from "@/lib/website-source-options";
import { useEmbeddingStore } from "@/store/embedding-store";
import { useWebsiteSourceStore } from "@/store/website-source-store";

export default function WebsiteSourceDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSelectedWebsiteSource = useWebsiteSourceStore((state) => state.setSelectedWebsiteSource);
  const setSourceStatus = useEmbeddingStore((state) => state.setSourceStatus);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const websiteSourceId = params.id;

  const query = useQuery({
    queryKey: ["website-sources", websiteSourceId],
    queryFn: async () => {
      const websiteSource = await authApi.websiteSource(websiteSourceId);
      setSelectedWebsiteSource(websiteSource);
      return websiteSource;
    },
    refetchInterval: (queryResult) => {
      const status = queryResult.state.data?.status;
      return status === "PENDING" || status === "SCRAPING" ? 3000 : false;
    },
  });

  const rescrape = useMutation({
    mutationFn: authApi.rescrapeWebsiteSource,
    onSuccess: () => {
      setNotice("Website scraping queued.");
      void queryClient.invalidateQueries({ queryKey: ["website-sources", websiteSourceId] });
      void queryClient.invalidateQueries({ queryKey: ["website-sources"] });
    },
  });

  const embeddingStatusQuery = useQuery({
    queryKey: ["embedding-status", websiteSourceId],
    queryFn: async () => {
      const status = await authApi.embeddingStatus(websiteSourceId);
      setSourceStatus(status);
      return status;
    },
    refetchInterval: (queryResult) => {
      const status = queryResult.state.data?.status;
      return status === "SCRAPING" || status === "PENDING" ? 3000 : false;
    },
  });

  const processEmbeddings = useMutation({
    mutationFn: authApi.processWebsiteEmbeddings,
    onSuccess: () => {
      setNotice("Website embedding processing queued.");
      void queryClient.invalidateQueries({ queryKey: ["embedding-status", websiteSourceId] });
      void queryClient.invalidateQueries({ queryKey: ["website-sources", websiteSourceId] });
      void queryClient.invalidateQueries({ queryKey: ["embedding-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["embedding-chunks"] });
    },
  });

  const deleteWebsite = useMutation({
    mutationFn: authApi.deleteWebsiteSource,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["website-sources"] });
      router.push("/website-sources");
    },
  });

  if (query.isLoading) {
    return <PageLoader label="Loading website source..." />;
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {query.error instanceof Error ? query.error.message : "Website source not found."}
      </div>
    );
  }

  const websiteSource = query.data;
  const wordCount = websiteSource.content?.wordCount ?? 0;
  const characterCount = websiteSource.content?.content.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={websiteSource.title ?? "Website source"}
        description="Extracted website content is scoped to the current organization and knowledge base."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/website-sources">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All Websites
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={rescrape.isPending}
              onClick={() => rescrape.mutate(websiteSource.id)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {rescrape.isPending ? "Queuing..." : "Re-scrape"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
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

      {rescrape.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {rescrape.error.message}
        </div>
      ) : null}

      {processEmbeddings.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {processEmbeddings.error.message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Website information</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <Detail label="URL" value={websiteSource.url} externalHref={websiteSource.url} />
            <Detail label="Title" value={websiteSource.title ?? "Untitled"} />
            <Detail label="Description" value={websiteSource.description ?? "No description"} />
            <Detail label="Knowledge Base" value={websiteSource.knowledgeBase.name} />
            <Detail
              label="Status"
              value={
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                    websiteSourceStatusTone(websiteSource.status),
                  )}
                >
                  {formatWebsiteSourceStatus(websiteSource.status)}
                </span>
              }
            />
            <Detail label="Word Count" value={String(wordCount)} />
            <Detail label="Created Date" value={formatDateTime(websiteSource.createdAt)} />
            <Detail label="Last Scraped" value={formatDateTime(websiteSource.lastScrapedAt)} />
          </dl>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <Globe2 className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold">Content statistics</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Words" value={wordCount.toLocaleString()} />
            <Metric label="Characters" value={characterCount.toLocaleString()} />
            <Metric
              label="HTML Snapshot"
              value={websiteSource.content?.htmlContent ? "Stored" : "Empty"}
            />
          </div>
        </div>
      </section>

      <EmbeddingStatusCard
        status={embeddingStatusQuery.data}
        isProcessing={processEmbeddings.isPending}
        onProcess={() => processEmbeddings.mutate(websiteSource.id)}
      />

      <section className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Extracted content</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            This readable text snapshot is ready for later ingestion, chunking, embeddings, and AI
            retrieval.
          </p>
        </div>
        {websiteSource.content?.content ? (
          <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap p-6 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
            {websiteSource.content.content}
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              icon={Globe2}
              title={
                websiteSource.status === "FAILED" ? "Failed extraction" : "No extracted content"
              }
              description={
                websiteSource.status === "FAILED"
                  ? "The scraper could not extract readable content from this URL. Re-scrape after confirming the page is public and reachable."
                  : "Content will appear here after the scraping job completes."
              }
              action={
                <Button
                  variant="outline"
                  disabled={rescrape.isPending}
                  onClick={() => rescrape.mutate(websiteSource.id)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Re-scrape
                </Button>
              }
            />
          </div>
        )}
      </section>

      {deleteOpen ? (
        <ConfirmDeleteDialog
          title={websiteSource.title ?? websiteSource.url}
          isDeleting={deleteWebsite.isPending}
          error={deleteWebsite.error}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => deleteWebsite.mutate(websiteSource.id)}
        />
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  externalHref,
}: {
  label: string;
  value: React.ReactNode;
  externalHref?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 break-words font-medium">
        {externalHref ? (
          <a
            className="inline-flex items-center gap-1 text-teal-700 hover:underline dark:text-teal-300"
            href={externalHref}
            rel="noreferrer"
            target="_blank"
          >
            {value}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs uppercase text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function ConfirmDeleteDialog({
  title,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  isDeleting: boolean;
  error?: Error | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Delete website source?</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          This will remove {title} and its extracted content from the knowledge base.
        </p>
        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error.message}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
