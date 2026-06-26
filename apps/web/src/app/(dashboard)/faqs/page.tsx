"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FaqStatus, FaqSummary } from "@ai-agent-platform/types";
import { Eye, HelpCircle, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useRagStore } from "@/store/rag-store";

export default function FaqsPage() {
  const queryClient = useQueryClient();
  const setFaqs = useRagStore((state) => state.setFaqs);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<FaqStatus | "ALL">("ALL");
  const [deleteTarget, setDeleteTarget] = useState<FaqSummary | null>(null);

  const query = useQuery({
    queryKey: ["faqs", { page, search, status }],
    queryFn: async () => {
      const result = await authApi.faqs({
        page,
        limit: 10,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setFaqs(result);
      return result;
    },
  });
  const deleteFaq = useMutation({
    mutationFn: authApi.deleteFaq,
    onSuccess: () => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
  });
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 10));

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQs"
        description="Manage concise question and answer knowledge for tenant-scoped retrieval."
        action={
          <Button asChild>
            <Link href="/faqs/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create FAQ
            </Link>
          </Button>
        }
      />
      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row">
          <form
            className="relative flex-1"
            onSubmit={(event: React.FormEvent) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" aria-hidden="true" />
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Search questions and answers"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as FaqStatus | "ALL");
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </section>
      {query.error ? <ErrorNotice error={query.error} /> : null}
      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Question</th>
                <th className="px-6 py-3 font-medium">Knowledge Base</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={5} className="px-6 py-4">
                        <SkeletonBlock className="h-8" />
                      </td>
                    </tr>
                  ))
                : null}
              {query.data?.data.map((faq) => (
                <FaqRow key={faq.id} faq={faq} onDelete={() => setDeleteTarget(faq)} />
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && query.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={HelpCircle}
              title="No FAQs yet"
              description="Create an FAQ to add direct question and answer knowledge."
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 text-sm dark:border-zinc-800">
          <span className="text-zinc-500">
            Page {page} of {totalPages}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-xl dark:bg-zinc-950">
            <h2 className="font-semibold">Delete FAQ</h2>
            <p className="mt-3 text-sm text-zinc-500">
              This removes the FAQ from future retrieval results.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                disabled={deleteFaq.isPending}
                onClick={() => deleteFaq.mutate(deleteTarget.id)}
              >
                {deleteFaq.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FaqRow({ faq, onDelete }: { faq: FaqSummary; onDelete: () => void }) {
  return (
    <tr>
      <td className="max-w-md px-6 py-4 font-medium">
        <span className="line-clamp-2">{faq.question}</span>
      </td>
      <td className="px-6 py-4 text-zinc-500">{faq.knowledgeBase?.name ?? "Knowledge base"}</td>
      <td className="px-6 py-4">
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-900">
          {faq.status}
        </span>
      </td>
      <td className="px-6 py-4 text-zinc-500">{new Date(faq.createdAt).toLocaleDateString()}</td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">FAQ actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/faqs/${faq.id}`}>
                <Eye className="h-4 w-4" /> View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/faqs/${faq.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error instanceof Error ? error.message : "Unable to load FAQs."}
    </div>
  );
}
