"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WebsiteSourceStatus, WebsiteSourceSummary } from "@ai-agent-platform/types";
import { Eye, Globe2, MoreHorizontal, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import {
  formatDateTime,
  formatWebsiteSourceStatus,
  websiteSourceStatuses,
  websiteSourceStatusTone,
} from "@/lib/website-source-options";
import { useWebsiteSourceStore } from "@/store/website-source-store";

export default function WebsiteSourcesPage() {
  const queryClient = useQueryClient();
  const page = useWebsiteSourceStore((state) => state.page);
  const limit = useWebsiteSourceStore((state) => state.limit);
  const search = useWebsiteSourceStore((state) => state.search);
  const status = useWebsiteSourceStore((state) => state.status);
  const knowledgeBaseId = useWebsiteSourceStore((state) => state.knowledgeBaseId);
  const setWebsiteSources = useWebsiteSourceStore((state) => state.setWebsiteSources);
  const setPage = useWebsiteSourceStore((state) => state.setPage);
  const setSearch = useWebsiteSourceStore((state) => state.setSearch);
  const setStatus = useWebsiteSourceStore((state) => state.setStatus);
  const setKnowledgeBaseId = useWebsiteSourceStore((state) => state.setKnowledgeBaseId);
  const [searchInput, setSearchInput] = useState(search);
  const [deleteTarget, setDeleteTarget] = useState<WebsiteSourceSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases", "options"],
    queryFn: () => authApi.knowledgeBases({ limit: 100 }),
  });

  const query = useQuery({
    queryKey: ["website-sources", { page, limit, search, status, knowledgeBaseId }],
    queryFn: async () => {
      const result = await authApi.websiteSources({
        page,
        limit,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
        knowledgeBaseId: knowledgeBaseId || undefined,
      });
      setWebsiteSources(result);
      return result;
    },
  });

  const rescrape = useMutation({
    mutationFn: authApi.rescrapeWebsiteSource,
    onSuccess: () => {
      setNotice("Website scraping queued.");
      void queryClient.invalidateQueries({ queryKey: ["website-sources"] });
    },
  });

  const deleteWebsite = useMutation({
    mutationFn: authApi.deleteWebsiteSource,
    onSuccess: () => {
      setNotice("Website source deleted.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["website-sources"] });
    },
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Sources"
        description="Submit public URLs and extract readable website content into your knowledge base."
        action={
          <Button asChild>
            <Link href="/website-sources/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Website
            </Link>
          </Button>
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

      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <form className="relative w-full max-w-xl" onSubmit={applySearch}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Search websites"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={knowledgeBaseId}
            onChange={(event) => setKnowledgeBaseId(event.target.value)}
          >
            <option value="">All knowledge bases</option>
            {knowledgeBasesQuery.data?.data.map((knowledgeBase) => (
              <option key={knowledgeBase.id} value={knowledgeBase.id}>
                {knowledgeBase.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={status}
            onChange={(event) => setStatus(event.target.value as WebsiteSourceStatus | "ALL")}
          >
            <option value="ALL">All statuses</option>
            {websiteSourceStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {query.error || rescrape.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {(query.error ?? rescrape.error) instanceof Error
            ? (query.error ?? rescrape.error)?.message
            : "Unable to load website sources."}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">URL</th>
                <th className="px-6 py-3 font-medium">Knowledge Base</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Word Count</th>
                <th className="px-6 py-3 font-medium">Last Scraped</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isLoading ? <WebsiteSourceTableSkeleton /> : null}
              {query.data?.data.map((websiteSource) => (
                <WebsiteSourceRow
                  key={websiteSource.id}
                  websiteSource={websiteSource}
                  onRescrape={() => rescrape.mutate(websiteSource.id)}
                  onDelete={() => setDeleteTarget(websiteSource)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!query.isLoading && query.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Globe2}
              title="No websites added"
              description="Add a public URL to extract readable content for future retrieval pipelines."
              action={
                <Button asChild>
                  <Link href="/website-sources/create">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Website
                  </Link>
                </Button>
              }
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-zinc-200 px-6 py-4 text-sm dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {deleteTarget ? (
        <ConfirmDeleteDialog
          websiteSource={deleteTarget}
          isDeleting={deleteWebsite.isPending}
          error={deleteWebsite.error}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteWebsite.mutate(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function WebsiteSourceRow({
  websiteSource,
  onRescrape,
  onDelete,
}: {
  websiteSource: WebsiteSourceSummary;
  onRescrape: () => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4 font-medium">
        <Link className="hover:text-teal-700" href={`/website-sources/${websiteSource.id}`}>
          {websiteSource.title ?? "Untitled website"}
        </Link>
      </td>
      <td className="max-w-[260px] px-6 py-4">
        <span className="block truncate text-zinc-500 dark:text-zinc-400" title={websiteSource.url}>
          {websiteSource.url}
        </span>
      </td>
      <td className="px-6 py-4">{websiteSource.knowledgeBase.name}</td>
      <td className="px-6 py-4">
        <StatusBadge status={websiteSource.status} />
      </td>
      <td className="px-6 py-4">{websiteSource.content?.wordCount ?? 0}</td>
      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
        {formatDateTime(websiteSource.lastScrapedAt)}
      </td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${websiteSource.url}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/website-sources/${websiteSource.id}`}>
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRescrape}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Re-scrape
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function WebsiteSourceTableSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index}>
      {Array.from({ length: 7 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-6 py-4">
          <SkeletonBlock className="h-4 w-full" />
        </td>
      ))}
    </tr>
  ));
}

function StatusBadge({ status }: { status: WebsiteSourceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        websiteSourceStatusTone(status),
      )}
    >
      {formatWebsiteSourceStatus(status)}
    </span>
  );
}

function ConfirmDeleteDialog({
  websiteSource,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  websiteSource: WebsiteSourceSummary;
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
          This will remove {websiteSource.title ?? websiteSource.url} from this knowledge base.
          Extracted content can be restored later from audit and source history work.
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
