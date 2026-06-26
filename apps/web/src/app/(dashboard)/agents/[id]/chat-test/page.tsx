"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { MessageTimeline } from "@/components/conversations/message-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useChatStore } from "@/store/chat-store";

export default function AgentChatTestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const latestResponse = useChatStore((state) => state.latestResponse);
  const setLatestResponse = useChatStore((state) => state.setLatestResponse);
  const setStreaming = useChatStore((state) => state.setStreaming);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const agent = useQuery({ queryKey: ["agents", id], queryFn: () => authApi.agent(id) });
  const conversation = useQuery({
    queryKey: ["conversations", conversationId],
    enabled: Boolean(conversationId),
    queryFn: () => authApi.conversation(conversationId!),
  });
  const createConversation = useMutation({
    mutationFn: () => authApi.createConversation({ agentId: id, channel: "WEB_CHAT" }),
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const sendMessage = useMutation({
    mutationFn: (content: string) => {
      if (!conversationId) {
        throw new Error("Start a conversation first.");
      }
      return authApi.sendChatMessage({ agentId: id, conversationId, message: content });
    },
    onMutate: () => {
      setStreaming(true);
    },
    onSuccess: (response) => {
      setLatestResponse(response);
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["conversations", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onSettled: () => setStreaming(false),
  });
  const messages = useMemo(() => conversation.data?.messages ?? [], [conversation.data?.messages]);

  if (agent.isLoading) {
    return <PageLoader label="Loading chat test..." />;
  }

  if (!agent.data) {
    return <div className="text-sm text-red-600">Agent not found.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat Test"
        description={`Test OpenAI-powered responses for ${agent.data.name} before website or voice launch.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/agents/${id}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Agent
              </Link>
            </Button>
            {conversationId ? (
              <Button
                variant="outline"
                onClick={() => router.push(`/conversations/${conversationId}`)}
              >
                Open Conversation
              </Button>
            ) : null}
          </div>
        }
      />
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Agent information</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Detail label="Name" value={agent.data.name} />
            <Detail label="Language" value={agent.data.language} />
            <Detail label="Voice" value={agent.data.voice} />
            <Detail label="Status" value={agent.data.status} />
          </dl>
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-xs uppercase text-zinc-500">System Prompt</p>
            <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">
              {agent.data.systemPrompt}
            </p>
          </div>
          {latestResponse ? (
            <div className="mt-4 grid gap-3 text-sm">
              <Detail label="Model" value={latestResponse.model} />
              <Detail label="Response Time" value={`${latestResponse.responseTime}ms`} />
              <Detail label="Tokens" value={String(latestResponse.tokenUsage.totalTokens)} />
              <Detail
                label="Retrieved Sources"
                value={String(latestResponse.metadata.retrievalCount)}
              />
            </div>
          ) : null}
          <Button
            className="mt-6 w-full"
            disabled={createConversation.isPending || Boolean(conversationId)}
            onClick={() => createConversation.mutate()}
          >
            {conversationId
              ? "Conversation Started"
              : createConversation.isPending
                ? "Starting..."
                : "Start Conversation"}
          </Button>
          {createConversation.error ? <ErrorNotice error={createConversation.error} /> : null}
        </div>
        <div className="flex min-h-[620px] flex-col rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length > 0 ? (
              <>
                <MessageTimeline messages={messages} />
                {sendMessage.isPending ? (
                  <div className="mt-4 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                    Assistant is thinking...
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
                Start a conversation, then send a test message. The message will be stored in the
                conversation history.
              </div>
            )}
          </div>
          <form
            className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            onSubmit={(event) => {
              event.preventDefault();
              if (message.trim()) {
                sendMessage.mutate(message.trim());
              }
            }}
          >
            <div className="flex gap-2">
              <input
                className="h-10 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Type a test message"
                disabled={!conversationId || sendMessage.isPending}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <Button type="submit" disabled={!conversationId || sendMessage.isPending}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </Button>
            </div>
            {sendMessage.error ? <ErrorNotice error={sendMessage.error} /> : null}
          </form>
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

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error instanceof Error ? error.message : "Request failed."}
    </div>
  );
}
