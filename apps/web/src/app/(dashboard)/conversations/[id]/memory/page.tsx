"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Brain, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useMemoryStore } from "@/store/memory-store";

export default function ConversationMemoryPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const setSelectedMemory = useMemoryStore((state) => state.setSelectedMemory);

  const memory = useQuery({
    queryKey: ["conversation-memory", id],
    queryFn: async () => {
      const result = await authApi.conversationMemory(id);
      setSelectedMemory(result);
      return result;
    },
  });

  const refresh = useMutation({
    mutationFn: () => authApi.refreshConversationMemory(id),
    onSuccess: (result) => {
      setSelectedMemory(result);
      void queryClient.invalidateQueries({ queryKey: ["conversation-memory", id] });
    },
  });

  const deleteFact = useMutation({
    mutationFn: authApi.deleteMemoryFact,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["conversation-memory", id] }),
  });

  if (memory.isLoading) {
    return <PageLoader label="Loading conversation memory..." />;
  }

  if (memory.error || !memory.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {memory.error instanceof Error ? memory.error.message : "Conversation memory not found."}
      </div>
    );
  }

  const data = memory.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversation memory"
        description="Long-term summary, durable facts, and token savings for this conversation."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/conversations/${id}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Conversation
              </Link>
            </Button>
            <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {refresh.isPending ? "Refreshing..." : "Refresh Memory"}
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Messages Processed" value={data.statistics.messagesProcessed} />
        <Stat label="Memory Updates" value={data.statistics.memoryUpdates} />
        <Stat label="Token Savings" value={data.statistics.tokenSavingsEstimate} />
        <Stat label="Facts" value={data.statistics.factCount} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold">Memory summary</h2>
          </div>
          {data.summary ? (
            <div className="mt-5 space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {data.summary.summary}
              </p>
              <p className="text-xs text-zinc-500">
                Generated {new Date(data.summary.generatedAt).toLocaleString()} after{" "}
                {data.summary.messageCount} messages.
              </p>
            </div>
          ) : (
            <EmptyCopy
              title="No memory generated yet"
              description="Memory is generated automatically every 20 messages, or you can refresh it manually."
            />
          )}
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Generation history</h2>
          <div className="mt-5 space-y-3">
            {data.history.length > 0 ? (
              data.history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <p className="font-medium">{new Date(item.generatedAt).toLocaleString()}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.messageCount} messages · {item.tokenEstimate} estimated tokens
                  </p>
                </div>
              ))
            ) : (
              <EmptyCopy title="No history" description="Memory generations will appear here." />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Memory facts</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Structured facts available to future AI responses.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900/50">
              <tr>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Key</th>
                <th className="px-6 py-3 font-medium">Value</th>
                <th className="px-6 py-3 font-medium">Confidence</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.facts.map((fact) => (
                <tr key={fact.id}>
                  <td className="whitespace-nowrap px-6 py-4 font-medium">
                    {formatFactType(fact.factType)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {fact.factKey}
                  </td>
                  <td className="min-w-[260px] px-6 py-4 text-zinc-600 dark:text-zinc-300">
                    {fact.factValue}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {Math.round(fact.confidence * 100)}%
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-500">
                    {new Date(fact.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteFact.isPending}
                      onClick={() => deleteFact.mutate(fact.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.facts.length === 0 ? (
          <div className="px-6 py-10">
            <EmptyCopy
              title="No facts extracted"
              description="Refresh memory after a meaningful conversation to extract durable facts."
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyCopy({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-zinc-500">{description}</p>
    </div>
  );
}

function formatFactType(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
