"use client";

import type {
  ConversationSummary,
  MessageSummary,
  RagRetrievedChunk,
  RagSourceCitation,
  SendChatMessageResponse,
} from "@ai-agent-platform/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Bot,
  Code2,
  FileText,
  Globe2,
  HelpCircle,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, cn } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { formatAgentLanguage, formatAgentStatus, formatAgentVoice } from "@/lib/agent-options";
import { authApi } from "@/lib/auth-api";
import { formatConversationChannel, formatConversationStatus } from "@/lib/conversation-options";
import { useAgentTestStore } from "@/store/agent-test-store";

export default function AgentTestPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const {
    activeConversationId,
    selectedConversation,
    latestResponse,
    latestSources,
    latestChunks,
    sessionTokenUsage,
    setActiveConversationId,
    setSelectedConversation,
    setLatestResponse,
    resetSessionAnalytics,
  } = useAgentTestStore();

  const agent = useQuery({
    queryKey: ["agents", agentId],
    queryFn: () => authApi.agent(agentId),
  });
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases", "agent-test", agentId],
    queryFn: () => authApi.knowledgeBases({ limit: 50 }),
  });
  const conversations = useQuery({
    queryKey: ["conversations", "agent-test", agentId],
    queryFn: () => authApi.conversations({ agentId, limit: 12 }),
  });
  const conversation = useQuery({
    queryKey: ["conversations", activeConversationId],
    enabled: Boolean(activeConversationId),
    queryFn: async () => {
      const result = await authApi.conversation(activeConversationId!);
      setSelectedConversation(result);
      return result;
    },
  });
  const memory = useQuery({
    queryKey: ["conversation-memory", activeConversationId],
    enabled: Boolean(activeConversationId),
    queryFn: () => authApi.conversationMemory(activeConversationId!),
  });

  const createConversation = useMutation({
    mutationFn: () => authApi.createConversation({ agentId, channel: "WEB_CHAT" }),
    onSuccess: (result) => {
      resetSessionAnalytics();
      setActiveConversationId(result.conversationId);
      void queryClient.invalidateQueries({ queryKey: ["conversations", "agent-test", agentId] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const created = await authApi.createConversation({ agentId, channel: "WEB_CHAT" });
        conversationId = created.conversationId;
        setActiveConversationId(conversationId);
      }
      return authApi.sendChatMessage({ agentId, conversationId, message: content });
    },
    onSuccess: (response) => {
      setLatestResponse(response);
      setDraft("");
      void queryClient.invalidateQueries({
        queryKey: ["conversations", response.userMessage.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["conversation-memory", response.userMessage.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["conversations", "agent-test", agentId] });
    },
  });

  const archiveConversation = useMutation({
    mutationFn: authApi.archiveConversation,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations", result.id] });
      void queryClient.invalidateQueries({ queryKey: ["conversations", "agent-test", agentId] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: authApi.deleteConversation,
    onSuccess: () => {
      setActiveConversationId(null);
      setSelectedConversation(null);
      resetSessionAnalytics();
      void queryClient.invalidateQueries({ queryKey: ["conversations", "agent-test", agentId] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.data?.messages.length, sendMessage.isPending]);

  const assignedKnowledgeBases = useMemo(
    () =>
      knowledgeBases.data?.data.filter((knowledgeBase) => knowledgeBase.agentId === agentId) ?? [],
    [agentId, knowledgeBases.data?.data],
  );
  const messages = conversation.data?.messages ?? selectedConversation?.messages ?? [];
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.senderType === "ASSISTANT");
  const responseMetadata = latestResponse ?? responseFromMessage(lastAssistant);
  const displaySources =
    latestSources.length > 0 ? latestSources : readSources(lastAssistant?.metadata);
  const displayChunks = latestChunks;

  if (agent.isLoading) {
    return <PageLoader label="Loading agent testing workspace..." />;
  }

  if (agent.error || !agent.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {agent.error instanceof Error ? agent.error.message : "Agent not found."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${agent.data.name} Test`}
        description="Run tenant-scoped conversations, inspect responses, and debug knowledge and memory before deployment."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/agents/${agentId}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Agent
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/agents/${agentId}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit Agent
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void agent.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              onClick={() => createConversation.mutate()}
              disabled={createConversation.isPending}
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              New Conversation
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <HeaderStat label="Status" value={formatAgentStatus(agent.data.status)} />
        <HeaderStat label="Language" value={formatAgentLanguage(agent.data.language)} />
        <HeaderStat label="Voice" value={formatAgentVoice(agent.data.voice)} />
        <HeaderStat label="Knowledge Bases" value={assignedKnowledgeBases.length} />
      </section>

      <section className="grid min-h-[calc(100vh-260px)] gap-5 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
        <aside className="order-2 space-y-5 xl:order-1">
          <Panel title="Agent Info">
            <dl className="grid gap-3 text-sm">
              <Detail label="Created" value={new Date(agent.data.createdAt).toLocaleString()} />
              <Detail label="Updated" value={new Date(agent.data.updatedAt).toLocaleString()} />
              <Detail label="Model" value={responseMetadata?.model ?? "Configured on backend"} />
              <Detail label="Status" value={formatAgentStatus(agent.data.status)} />
            </dl>
          </Panel>

          <Panel title="Conversations">
            <div className="space-y-2">
              {conversations.data?.data.length ? (
                conversations.data.data.map((item) => (
                  <ConversationRow
                    key={item.id}
                    conversation={item}
                    active={item.id === activeConversationId}
                    onSelect={() => {
                      resetSessionAnalytics();
                      setActiveConversationId(item.id);
                    }}
                  />
                ))
              ) : (
                <EmptyStateText text="No conversations yet. Start a new one to test this agent." />
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                disabled={!activeConversationId || archiveConversation.isPending}
                onClick={() =>
                  activeConversationId && archiveConversation.mutate(activeConversationId)
                }
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                disabled={!activeConversationId || deleteConversation.isPending}
                onClick={() =>
                  activeConversationId && deleteConversation.mutate(activeConversationId)
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </Panel>

          <Panel title="Agent Configuration">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase text-zinc-500">System Prompt</p>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                  {agent.data.systemPrompt}
                </pre>
              </div>
              <div>
                <p className="text-xs uppercase text-zinc-500">Knowledge Bases</p>
                <div className="mt-2 space-y-2">
                  {assignedKnowledgeBases.length ? (
                    assignedKnowledgeBases.map((knowledgeBase) => (
                      <div
                        key={knowledgeBase.id}
                        className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                      >
                        <p className="font-medium">{knowledgeBase.name}</p>
                        <p className="text-xs text-zinc-500">{knowledgeBase.status}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyStateText text="No assigned knowledge bases." />
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </aside>

        <main className="order-1 flex min-h-[640px] flex-col rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30 xl:order-2">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <h2 className="text-base font-semibold">Chat Window</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {activeConversationId
                  ? `Conversation ${activeConversationId.slice(0, 8)}`
                  : "No active conversation"}
              </p>
            </div>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              {conversation.data ? formatConversationStatus(conversation.data.status) : "Ready"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {messages.length ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <TestMessage key={message.id} message={message} />
                ))}
                {sendMessage.isPending ? (
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white dark:bg-zinc-950">
                      <Bot className="h-4 w-4 animate-pulse" aria-hidden="true" />
                    </span>
                    Assistant is thinking...
                  </div>
                ) : null}
                <div ref={scrollRef} />
              </div>
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center">
                <div>
                  <Bot className="mx-auto h-8 w-8 text-teal-700" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-semibold">Start an agent test</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                    Send a message to create a stored conversation and inspect sources, memory, and
                    token usage.
                  </p>
                </div>
              </div>
            )}
          </div>
          <form
            className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) {
                sendMessage.mutate(draft.trim());
              }
            }}
          >
            <div className="flex gap-2">
              <textarea
                className="min-h-12 flex-1 resize-none rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-5 outline-none focus:border-teal-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Ask a test question..."
                value={draft}
                disabled={sendMessage.isPending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (draft.trim()) {
                      sendMessage.mutate(draft.trim());
                    }
                  }
                }}
              />
              <Button type="submit" disabled={sendMessage.isPending || draft.trim().length < 2}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </Button>
            </div>
            {sendMessage.error || createConversation.error ? (
              <ErrorNotice error={sendMessage.error ?? createConversation.error} />
            ) : null}
          </form>
        </main>

        <aside className="order-3 space-y-5">
          <Panel title="Response Analytics">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Response"
                value={responseMetadata ? `${responseMetadata.responseTime}ms` : "—"}
              />
              <Metric label="Model" value={responseMetadata?.model ?? "—"} />
              <Metric label="Sources" value={displaySources.length} />
              <Metric
                label="Chunks"
                value={displayChunks.length || responseMetadata?.metadata.retrievalCount || 0}
              />
              <Metric
                label="Memory"
                value={responseMetadata?.metadata.memoryUsed ? "Used" : "None"}
              />
              <Metric
                label="Facts"
                value={
                  responseMetadata?.metadata.memoryFactCount ??
                  memory.data?.statistics.factCount ??
                  0
                }
              />
            </div>
          </Panel>

          <Panel title="Token Analytics">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Prompt" value={responseMetadata?.tokenUsage.promptTokens ?? 0} />
              <Metric
                label="Completion"
                value={responseMetadata?.tokenUsage.completionTokens ?? 0}
              />
              <Metric label="Total" value={responseMetadata?.tokenUsage.totalTokens ?? 0} />
              <Metric label="Session" value={sessionTokenUsage.totalTokens} />
              <Metric
                label="Estimated Cost"
                value={formatEstimatedCost(responseMetadata?.tokenUsage.totalTokens ?? 0)}
              />
              <Metric
                label="Session Cost"
                value={formatEstimatedCost(sessionTokenUsage.totalTokens)}
              />
            </div>
          </Panel>

          <Panel title="Source Citations">
            {displaySources.length ? (
              <div className="space-y-3">
                {displaySources.map((source) => (
                  <SourceItem
                    key={`${source.sourceType}-${source.sourceId}-${source.chunkReference}`}
                    source={source}
                  />
                ))}
              </div>
            ) : (
              <EmptyStateText text="No sources were returned for the latest response." />
            )}
          </Panel>

          <Panel title="Knowledge Debug">
            {displayChunks.length ? (
              <div className="space-y-3">
                {displayChunks.map((chunk) => (
                  <ChunkItem key={chunk.chunkId} chunk={chunk} />
                ))}
              </div>
            ) : (
              <EmptyStateText text="Retrieved chunks will appear after the next AI response." />
            )}
          </Panel>

          <Panel title="Memory Debug">
            {memory.data?.summary ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-zinc-500">Summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {memory.data.summary.summary}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Refreshed {new Date(memory.data.summary.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-2">
                  {memory.data.facts.map((fact) => (
                    <div
                      key={fact.id}
                      className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                    >
                      <p className="text-xs uppercase text-zinc-500">
                        {formatLabel(fact.factType)}
                      </p>
                      <p className="mt-1 font-medium">{fact.factValue}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {fact.factKey} · {Math.round(fact.confidence * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyStateText text="No memory generated yet. Memory refreshes automatically every 20 messages." />
            )}
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-md border px-3 py-3 text-left text-sm transition",
        active
          ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{conversation.id.slice(0, 8)}</span>
        <span className="text-xs text-zinc-500">
          {formatConversationStatus(conversation.status)}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {formatConversationChannel(conversation.channel)} · {conversation.messageCount} messages
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {conversation.lastMessageAt
          ? new Date(conversation.lastMessageAt).toLocaleString()
          : new Date(conversation.createdAt).toLocaleString()}
      </p>
    </button>
  );
}

function TestMessage({ message }: { message: MessageSummary }) {
  const isUser = message.senderType === "USER";
  const isSystem = message.senderType === "SYSTEM";
  const sources = readSources(message.metadata);
  return (
    <article
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
        isSystem && "justify-center",
      )}
    >
      {!isUser ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
          {isSystem ? <Code2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-3xl rounded-md border px-4 py-3 text-sm shadow-sm",
          isUser
            ? "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100"
            : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
          isSystem && "max-w-xl bg-zinc-50 text-zinc-600",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span>{formatLabel(message.senderType)}</span>
          <time>{new Date(message.createdAt).toLocaleString()}</time>
        </div>
        <MarkdownLite content={message.content} />
        {sources.length ? (
          <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium text-zinc-500">Sources</p>
            <div className="space-y-2">
              {sources.map((source) => (
                <SourceItem
                  compact
                  key={`${source.sourceType}-${source.sourceId}-${source.chunkReference}`}
                  source={source}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MarkdownLite({ content }: { content: string }) {
  const blocks = content.split(/```/g);
  return (
    <div className="space-y-3 leading-6">
      {blocks.map((block, index) => {
        if (index % 2 === 1) {
          return (
            <pre
              key={`${index}-${block.slice(0, 12)}`}
              className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100"
            >
              <code>{block.trim()}</code>
            </pre>
          );
        }
        return <TextBlock key={`${index}-${block.slice(0, 12)}`} content={block} />;
      })}
    </div>
  );
}

function TextBlock({ content }: { content: string }) {
  const lines = content.split("\n").filter((line) => line.trim());
  const tableLines = lines.filter((line) => line.includes("|"));
  if (tableLines.length >= 2) {
    return <SimpleTable lines={tableLines} />;
  }
  return (
    <>
      {lines.map((line) => {
        const trimmed = line.trim();
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <p key={line} className="pl-4">
              • {trimmed.replace(/^[-*]\s+/, "")}
            </p>
          );
        }
        return (
          <p key={line} className="whitespace-pre-wrap">
            {trimmed.replace(/\*\*/g, "")}
          </p>
        );
      })}
    </>
  );
}

function SimpleTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line) =>
      line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter((row) => row.length > 1);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("-")}`}>
              {row.map((cell) => (
                <td key={cell} className="border border-zinc-200 px-2 py-1 dark:border-zinc-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceItem({ source, compact = false }: { source: RagSourceCitation; compact?: boolean }) {
  const Icon =
    source.sourceType === "document"
      ? FileText
      : source.sourceType === "website"
        ? Globe2
        : HelpCircle;
  return (
    <details
      className={cn(
        "rounded-md border border-zinc-200 dark:border-zinc-800",
        compact ? "px-2 py-1" : "p-3",
      )}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{source.sourceName}</span>
        <span className="text-xs text-zinc-500">{(source.relevanceScore * 100).toFixed(1)}%</span>
      </summary>
      <dl className="mt-3 grid gap-2 text-xs text-zinc-500">
        <Detail label="Type" value={source.sourceType.toUpperCase()} />
        <Detail label="Source ID" value={source.sourceId} />
        <Detail label="Knowledge Base" value={source.knowledgeBaseId} />
        <Detail label="Chunk Ref" value={String(source.chunkReference)} />
        {source.documentId ? <Detail label="Document ID" value={source.documentId} /> : null}
        {source.websiteSourceId ? (
          <Detail label="Website ID" value={source.websiteSourceId} />
        ) : null}
        {source.faqEntryId ? <Detail label="FAQ ID" value={source.faqEntryId} /> : null}
      </dl>
    </details>
  );
}

function ChunkItem({ chunk }: { chunk: RagRetrievedChunk }) {
  return (
    <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <summary className="cursor-pointer text-sm font-medium">
        Chunk {chunk.chunkIndex + 1} · {(chunk.relevanceScore * 100).toFixed(1)}%
      </summary>
      <div className="mt-3 space-y-2 text-xs text-zinc-500">
        <p>{chunk.sourceName}</p>
        <p>{chunk.knowledgeBaseName}</p>
        <p className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-2 leading-5 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {chunk.chunkText}
        </p>
        <p>{chunk.tokenCount} tokens</p>
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function EmptyStateText({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
      {text}
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error instanceof Error ? error.message : "Request failed."}
    </div>
  );
}

function readSources(metadata: unknown): RagSourceCitation[] {
  if (!metadata || typeof metadata !== "object" || !("sources" in metadata)) {
    return [];
  }

  const sources = (metadata as { sources?: unknown }).sources;
  return Array.isArray(sources) ? (sources as RagSourceCitation[]) : [];
}

function responseFromMessage(message?: MessageSummary): SendChatMessageResponse | null {
  if (!message || !message.metadata || typeof message.metadata !== "object") {
    return null;
  }
  const metadata = message.metadata as {
    model?: string;
    responseTime?: number;
    tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    retrievalCount?: number;
    knowledgeBaseIds?: string[];
    memoryUsed?: boolean;
    memoryFactCount?: number;
  };
  return {
    userMessage: message,
    assistantMessage: message,
    sources: readSources(message.metadata),
    retrievedChunks: [],
    tokenUsage: {
      promptTokens: metadata.tokenUsage?.promptTokens ?? 0,
      completionTokens: metadata.tokenUsage?.completionTokens ?? 0,
      totalTokens: metadata.tokenUsage?.totalTokens ?? message.tokenCount,
    },
    responseTime: metadata.responseTime ?? 0,
    model: metadata.model ?? "Unknown",
    metadata: {
      retrievalCount: metadata.retrievalCount ?? readSources(message.metadata).length,
      knowledgeBaseIds: metadata.knowledgeBaseIds ?? [],
      memoryUsed: Boolean(metadata.memoryUsed),
      memoryFactCount: metadata.memoryFactCount ?? 0,
      toolCalls: [],
    },
  };
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatEstimatedCost(tokens: number): string {
  if (!tokens) {
    return "$0.0000";
  }
  return `$${((tokens / 1_000_000) * 2).toFixed(4)}`;
}
