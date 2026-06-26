"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const threads = useQuery({
    queryKey: ["communications", "threads"],
    queryFn: () => authApi.communicationThreads({ limit: 100 }),
  });
  const activeThreadId = selectedThreadId || threads.data?.data[0]?.id || "";
  const messages = useQuery({
    queryKey: ["communications", "messages", activeThreadId],
    queryFn: () => authApi.communicationMessages({ threadId: activeThreadId, limit: 100 }),
    enabled: Boolean(activeThreadId),
  });
  const queue = useQuery({
    queryKey: ["communications", "queue"],
    queryFn: authApi.communicationQueue,
  });
  const selected = useMemo(
    () => threads.data?.data.find((thread) => thread.id === activeThreadId),
    [activeThreadId, threads.data],
  );
  const send = useMutation({
    mutationFn: () =>
      authApi.sendCommunication({
        phone: selected?.contact.phone || phone,
        message: body,
        threadId: selected?.id,
      }),
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["communications"] });
    },
  });
  const retry = useMutation({
    mutationFn: authApi.retryCommunication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communications"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        description="SMS threads, provider delivery state, retries, and queued appointment automations."
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Threads" value={threads.data?.total ?? 0} />
        <Metric label="Waiting" value={queue.data?.waiting ?? 0} />
        <Metric label="Reminders" value={queue.data?.delayed ?? 0} />
        <Metric label="Failed jobs" value={queue.data?.failed ?? 0} />
      </div>
      <section className="grid min-h-[620px] overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-zinc-200 dark:border-zinc-800 lg:border-b-0 lg:border-r">
          <div className="border-b border-zinc-200 p-4 text-sm font-semibold dark:border-zinc-800">
            SMS Threads
          </div>
          {threads.isLoading ? (
            <div className="p-4">
              <SkeletonBlock className="h-40" />
            </div>
          ) : null}
          {threads.data?.data.map((thread) => (
            <button
              key={thread.id}
              className={cn(
                "block w-full border-b border-zinc-100 p-4 text-left dark:border-zinc-900",
                thread.id === activeThreadId && "bg-teal-50 dark:bg-teal-950/30",
              )}
              onClick={() => setSelectedThreadId(thread.id)}
            >
              <div className="flex justify-between gap-3">
                <span className="truncate text-sm font-medium">{thread.contact.name}</span>
                <span className="text-xs text-zinc-500">{thread.unreadCount || ""}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">{thread.contact.phone ?? "No phone"}</div>
              <div className="mt-2 truncate text-xs text-zinc-500">
                {thread.messages[0]?.body ?? "No messages"}
              </div>
            </button>
          ))}
          {!threads.isLoading && !threads.data?.data.length ? (
            <div className="p-5">
              <EmptyState
                icon={MessageSquareText}
                title="No SMS threads"
                description="Appointment confirmations and AI follow-ups will appear here."
              />
            </div>
          ) : null}
        </aside>
        <div className="flex min-w-0 flex-col">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-semibold">{selected?.contact.name ?? "New SMS"}</h2>
            <p className="text-xs text-zinc-500">
              {selected?.contact.phone ?? "Enter a recipient number below"}
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50/60 p-5 dark:bg-zinc-950">
            {messages.data?.data
              .slice()
              .reverse()
              .map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[80%] rounded-lg border px-4 py-3 text-sm",
                    message.direction === "OUTBOUND"
                      ? "ml-auto border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/40"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-zinc-500">
                    <span>
                      {message.provider} · {message.status}
                    </span>
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  {message.status === "FAILED" ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(message.id)}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </Button>
                  ) : null}
                </div>
              ))}
          </div>
          <form
            className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800"
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            {!selected ? (
              <input
                className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Recipient phone (+1...)"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            ) : null}
            <div className="flex gap-3">
              <textarea
                className="min-h-20 flex-1 resize-none rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                placeholder="Write an SMS follow-up"
                maxLength={1000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <Button
                type="submit"
                disabled={send.isPending || !body.trim() || !(selected?.contact.phone || phone)}
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
