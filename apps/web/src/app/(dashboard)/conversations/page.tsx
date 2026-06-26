"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationStatus, ConversationSummary } from "@ai-agent-platform/types";
import { Eye, MessageSquare, MoreHorizontal, Search } from "lucide-react";
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
import {
  conversationStatuses,
  formatConversationChannel,
  formatConversationStatus,
} from "@/lib/conversation-options";
import { authApi } from "@/lib/auth-api";
import { useConversationStore } from "@/store/conversation-store";

export default function ConversationsPage() {
  const queryClient = useQueryClient();
  const page = useConversationStore((state) => state.page);
  const limit = useConversationStore((state) => state.limit);
  const search = useConversationStore((state) => state.search);
  const status = useConversationStore((state) => state.status);
  const setConversations = useConversationStore((state) => state.setConversations);
  const setAnalytics = useConversationStore((state) => state.setAnalytics);
  const setPage = useConversationStore((state) => state.setPage);
  const setSearch = useConversationStore((state) => state.setSearch);
  const setStatus = useConversationStore((state) => state.setStatus);
  const [searchInput, setSearchInput] = useState(search);

  const conversations = useQuery({
    queryKey: ["conversations", { page, limit, search, status }],
    queryFn: async () => {
      const result = await authApi.conversations({
        page,
        limit,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setConversations(result);
      return result;
    },
  });
  const analytics = useQuery({
    queryKey: ["conversations", "analytics"],
    queryFn: async () => {
      const result = await authApi.conversationAnalytics();
      setAnalytics(result);
      return result;
    },
  });
  const closeConversation = useMutation({
    mutationFn: authApi.closeConversation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
  const archiveConversation = useMutation({
    mutationFn: authApi.archiveConversation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
  const total = conversations.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        description="Review tenant-scoped conversation sessions across chat, voice, SMS, and WhatsApp."
      />
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Total" value={analytics.data?.totalConversations ?? 0} />
        <Stat label="Active" value={analytics.data?.activeConversations ?? 0} />
        <Stat label="Closed" value={analytics.data?.closedConversations ?? 0} />
        <Stat label="Avg Messages" value={(analytics.data?.averageMessages ?? 0).toFixed(1)} />
      </section>
      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form className="relative w-full max-w-xl" onSubmit={applySearch}>
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" aria-hidden="true" />
            <input
              className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
              placeholder="Search conversation, visitor, session, or agent"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </form>
          <select
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            value={status}
            onChange={(event) => setStatus(event.target.value as ConversationStatus | "ALL")}
          >
            <option value="ALL">All statuses</option>
            {conversationStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>
      {conversations.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {conversations.error instanceof Error
            ? conversations.error.message
            : "Unable to load conversations."}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Conversation ID</th>
                <th className="px-6 py-3 font-medium">Agent</th>
                <th className="px-6 py-3 font-medium">Channel</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Messages</th>
                <th className="px-6 py-3 font-medium">Last Activity</th>
                <th className="px-6 py-3 font-medium">Created Date</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {conversations.isLoading ? <ConversationSkeleton /> : null}
              {conversations.data?.data.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  onClose={() => closeConversation.mutate(conversation.id)}
                  onArchive={() => archiveConversation.mutate(conversation.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!conversations.isLoading && conversations.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              description="Use an agent chat test page to create an internal conversation session."
            />
          </div>
        ) : null}
        <div className="flex justify-between border-t border-zinc-200 px-6 py-4 text-sm dark:border-zinc-800">
          <span className="text-zinc-500">
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
    </div>
  );
}

function ConversationRow({
  conversation,
  onClose,
  onArchive,
}: {
  conversation: ConversationSummary;
  onClose: () => void;
  onArchive: () => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4 font-mono text-xs">{conversation.id.slice(0, 8)}</td>
      <td className="px-6 py-4 font-medium">{conversation.agent.name}</td>
      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
        {formatConversationChannel(conversation.channel)}
      </td>
      <td className="px-6 py-4">{formatConversationStatus(conversation.status)}</td>
      <td className="px-6 py-4">{conversation.messageCount}</td>
      <td className="px-6 py-4 text-zinc-500">
        {conversation.lastMessageAt
          ? new Date(conversation.lastMessageAt).toLocaleString()
          : "No messages"}
      </td>
      <td className="px-6 py-4 text-zinc-500">
        {new Date(conversation.createdAt).toLocaleDateString()}
      </td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Conversation actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/conversations/${conversation.id}`}>
                <Eye className="h-4 w-4" /> View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={conversation.status !== "ACTIVE"} onClick={onClose}>
              Close
            </DropdownMenuItem>
            <DropdownMenuItem disabled={conversation.status === "ARCHIVED"} onClick={onArchive}>
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function ConversationSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <tr key={index}>
          <td colSpan={8} className="px-6 py-4">
            <SkeletonBlock className="h-8" />
          </td>
        </tr>
      ))}
    </>
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
