"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Brain, Lock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { MessageTimeline } from "@/components/conversations/message-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import {
  formatConversationChannel,
  formatConversationStatus,
  formatDuration,
} from "@/lib/conversation-options";
import { authApi } from "@/lib/auth-api";
import { useConversationStore } from "@/store/conversation-store";

export default function ConversationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const setSelectedConversation = useConversationStore((state) => state.setSelectedConversation);

  const conversation = useQuery({
    queryKey: ["conversations", id],
    queryFn: async () => {
      const result = await authApi.conversation(id);
      setSelectedConversation(result);
      return result;
    },
  });
  const memory = useQuery({
    queryKey: ["conversation-memory", id],
    queryFn: () => authApi.conversationMemory(id),
  });
  const closeConversation = useMutation({
    mutationFn: authApi.closeConversation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["conversations", id] }),
  });
  const archiveConversation = useMutation({
    mutationFn: authApi.archiveConversation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["conversations", id] }),
  });

  if (conversation.isLoading) {
    return <PageLoader label="Loading conversation..." />;
  }

  if (conversation.error || !conversation.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {conversation.error instanceof Error
          ? conversation.error.message
          : "Conversation not found."}
      </div>
    );
  }

  const data = conversation.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversation details"
        description={`Agent: ${data.agent.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/conversations">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Conversations
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={data.status !== "ACTIVE" || closeConversation.isPending}
              onClick={() => closeConversation.mutate(data.id)}
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Close
            </Button>
            <Button
              disabled={data.status === "ARCHIVED" || archiveConversation.isPending}
              onClick={() => archiveConversation.mutate(data.id)}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archive
            </Button>
          </div>
        }
      />
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Status" value={formatConversationStatus(data.status)} />
        <Stat label="Channel" value={formatConversationChannel(data.channel)} />
        <Stat label="Messages" value={data.statistics.messageCount} />
        <Stat label="Duration" value={formatDuration(data.statistics.durationSeconds)} />
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Conversation information</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <Detail label="Conversation ID" value={data.id} />
            <Detail label="Agent" value={data.agent.name} />
            <Detail label="Session ID" value={data.sessionId ?? "Internal"} />
            <Detail label="Started" value={new Date(data.startedAt).toLocaleString()} />
            <Detail
              label="Last Activity"
              value={data.lastMessageAt ? new Date(data.lastMessageAt).toLocaleString() : "None"}
            />
            <Detail label="Tokens" value={String(data.statistics.tokenCount)} />
          </dl>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold">Memory</h2>
          </div>
          <div className="mt-5 grid gap-4 text-sm">
            <Detail
              label="Latest Summary"
              value={memory.data?.summary ? "Available" : "Not generated"}
            />
            <Detail label="Facts" value={String(memory.data?.statistics.factCount ?? 0)} />
            <Detail
              label="Last Generated"
              value={
                memory.data?.summary
                  ? new Date(memory.data.summary.generatedAt).toLocaleString()
                  : "None"
              }
            />
          </div>
          <Button className="mt-5 w-full" variant="outline" asChild>
            <Link href={`/conversations/${data.id}/memory`}>View Memory</Link>
          </Button>
        </div>
        <div className="min-h-[520px] rounded-md border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="mb-5 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold">Message timeline</h2>
          </div>
          <MessageTimeline messages={data.messages} />
          {data.messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No messages have been stored yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
