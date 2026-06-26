"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KnowledgeBaseStatus, KnowledgeBaseSummary } from "@ai-agent-platform/types";
import { BookOpen, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { formatKnowledgeBaseStatus, knowledgeBaseStatuses } from "@/lib/knowledge-base-options";
import { authApi } from "@/lib/auth-api";
import { useKnowledgeBaseStore } from "@/store/knowledge-base-store";

export default function KnowledgeBasesPage() {
  const queryClient = useQueryClient();
  const page = useKnowledgeBaseStore((state) => state.page);
  const limit = useKnowledgeBaseStore((state) => state.limit);
  const search = useKnowledgeBaseStore((state) => state.search);
  const status = useKnowledgeBaseStore((state) => state.status);
  const setKnowledgeBases = useKnowledgeBaseStore((state) => state.setKnowledgeBases);
  const setPage = useKnowledgeBaseStore((state) => state.setPage);
  const setSearch = useKnowledgeBaseStore((state) => state.setSearch);
  const setStatus = useKnowledgeBaseStore((state) => state.setStatus);
  const [searchInput, setSearchInput] = useState(search);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBaseSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["knowledge-bases", { page, limit, search, status }],
    queryFn: async () => {
      const result = await authApi.knowledgeBases({
        page,
        limit,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setKnowledgeBases(result);
      return result;
    },
  });

  const deleteKnowledgeBase = useMutation({
    mutationFn: authApi.deleteKnowledgeBase,
    onSuccess: () => {
      setNotice("Knowledge base deleted.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
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
        title="Knowledge Bases"
        description="Organize tenant-scoped repositories for future ingestion, embeddings, and retrieval."
        action={
          <Button asChild>
            <Link href="/knowledge-bases/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Knowledge Base
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form className="relative w-full max-w-xl" onSubmit={applySearch}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Search knowledge bases"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={status}
            onChange={(event) => setStatus(event.target.value as KnowledgeBaseStatus | "ALL")}
          >
            <option value="ALL">All statuses</option>
            {knowledgeBaseStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {query.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {query.error instanceof Error ? query.error.message : "Unable to load knowledge bases."}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Assigned Agent</th>
                <th className="px-6 py-3 font-medium">Documents Count</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created Date</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isLoading ? <KnowledgeBaseTableSkeleton /> : null}
              {query.data?.data.map((knowledgeBase) => (
                <KnowledgeBaseRow
                  key={knowledgeBase.id}
                  knowledgeBase={knowledgeBase}
                  onDelete={() => setDeleteTarget(knowledgeBase)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!query.isLoading && query.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BookOpen}
              title="No knowledge bases yet"
              description="Create a repository to organize documents before ingestion and retrieval are enabled."
              action={
                <Button asChild>
                  <Link href="/knowledge-bases/create">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create Knowledge Base
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
        <DeleteKnowledgeBaseDialog
          knowledgeBase={deleteTarget}
          isDeleting={deleteKnowledgeBase.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteKnowledgeBase.mutate(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function KnowledgeBaseRow({
  knowledgeBase,
  onDelete,
}: {
  knowledgeBase: KnowledgeBaseSummary;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="font-medium">{knowledgeBase.name}</div>
      </td>
      <td className="max-w-xs px-6 py-4 text-zinc-600 dark:text-zinc-300">
        <span className="line-clamp-2">{knowledgeBase.description ?? "No description"}</span>
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {knowledgeBase.assignedAgent?.name ?? "Unassigned"}
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">{knowledgeBase.documentsCount}</td>
      <td className="px-6 py-4">
        <StatusBadge status={knowledgeBase.status} />
      </td>
      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
        {new Date(knowledgeBase.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Knowledge base actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/knowledge-bases/${knowledgeBase.id}`}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/knowledge-bases/${knowledgeBase.id}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function KnowledgeBaseTableSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index}>
      {Array.from({ length: 7 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-6 py-4">
          <SkeletonBlock className="h-4 w-full" />
        </td>
      ))}
    </tr>
  ));
}

function StatusBadge({ status }: { status: KnowledgeBaseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        status === "ACTIVE" &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "DRAFT" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
        status === "INACTIVE" &&
          "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      )}
    >
      {formatKnowledgeBaseStatus(status)}
    </span>
  );
}

function DeleteKnowledgeBaseDialog({
  knowledgeBase,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  knowledgeBase: KnowledgeBaseSummary;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Delete knowledge base</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Are you sure you want to delete {knowledgeBase.name}?
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This soft deletes the repository and can be restored later.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
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
