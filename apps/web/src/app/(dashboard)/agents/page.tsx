"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentSummary, AgentStatus } from "@ai-agent-platform/types";
import { Bot, Copy, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import {
  agentStatuses,
  formatAgentLanguage,
  formatAgentStatus,
  formatAgentVoice,
} from "@/lib/agent-options";
import { authApi } from "@/lib/auth-api";
import { useAgentStore } from "@/store/agent-store";

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const page = useAgentStore((state) => state.page);
  const limit = useAgentStore((state) => state.limit);
  const search = useAgentStore((state) => state.search);
  const status = useAgentStore((state) => state.status);
  const setAgents = useAgentStore((state) => state.setAgents);
  const setPage = useAgentStore((state) => state.setPage);
  const setSearch = useAgentStore((state) => state.setSearch);
  const setStatus = useAgentStore((state) => state.setStatus);
  const [searchInput, setSearchInput] = useState(search);
  const [deleteTarget, setDeleteTarget] = useState<AgentSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["agents", { page, limit, search, status }],
    queryFn: async () => {
      const result = await authApi.agents({
        page,
        limit,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setAgents(result);
      return result;
    },
  });

  const duplicateAgent = useMutation({
    mutationFn: authApi.duplicateAgent,
    onSuccess: () => {
      setNotice("Agent duplicated.");
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const deleteAgent = useMutation({
    mutationFn: authApi.deleteAgent,
    onSuccess: () => {
      setNotice("Agent deleted.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
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
        title="Agents"
        description="Create and manage tenant-scoped AI agents for future knowledge, chat, and voice workflows."
        action={
          <Button asChild>
            <Link href="/agents/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Agent
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
              placeholder="Search agents"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={status}
            onChange={(event) => setStatus(event.target.value as AgentStatus | "ALL")}
          >
            <option value="ALL">All statuses</option>
            {agentStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {query.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {query.error instanceof Error ? query.error.message : "Unable to load agents."}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Language</th>
                <th className="px-6 py-3 font-medium">Voice</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created Date</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isLoading ? <AgentTableSkeleton /> : null}
              {query.data?.data.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  onDuplicate={() => duplicateAgent.mutate(agent.id)}
                  onDelete={() => setDeleteTarget(agent)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!query.isLoading && query.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Bot}
              title="No agents yet"
              description="Create your first agent to define its language, voice, and operating instructions."
              action={
                <Button asChild>
                  <Link href="/agents/create">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create Agent
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
        <DeleteAgentDialog
          agent={deleteTarget}
          isDeleting={deleteAgent.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteAgent.mutate(deleteTarget.id)}
        />
      ) : null}
    </div>
  );
}

function AgentRow({
  agent,
  onDuplicate,
  onDelete,
}: {
  agent: AgentSummary;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="font-medium">{agent.name}</div>
        <div className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
          {agent.description ?? "No description"}
        </div>
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {formatAgentLanguage(agent.language)}
      </td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {formatAgentVoice(agent.voice)}
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={agent.status} />
      </td>
      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
        {new Date(agent.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Agent actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="z-50 min-w-44 rounded-md border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
          >
            <DropdownMenuItem asChild>
              <Link
                href={`/agents/${agent.id}`}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/agents/${agent.id}/edit`}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none hover:bg-zinc-100 dark:hover:bg-zinc-900"
              onSelect={onDuplicate}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-red-600 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onSelect={onDelete}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function AgentTableSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index}>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-2 h-3 w-64" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-20" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-16" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-6 w-20" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-4 w-24" />
      </td>
      <td className="px-6 py-4">
        <SkeletonBlock className="h-8 w-8" />
      </td>
    </tr>
  ));
}

function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        status === "ACTIVE" && "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
        status === "DRAFT" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
        status === "INACTIVE" && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      )}
    >
      {formatAgentStatus(status)}
    </span>
  );
}

function DeleteAgentDialog({
  agent,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  agent: AgentSummary;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Delete agent</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Are you sure you want to delete this agent?
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This action can be restored later.
        </p>
        <div className="mt-6 rounded-md bg-zinc-50 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
          {agent.name}
        </div>
        <div className="mt-6 flex justify-end gap-3">
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
