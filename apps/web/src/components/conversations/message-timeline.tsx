"use client";

import type { MessageSummary } from "@ai-agent-platform/types";
import type { RagSourceCitation } from "@ai-agent-platform/types";
import { Bot, CircleUserRound, FileText, Globe2, HelpCircle, Info } from "lucide-react";
import { cn } from "@ai-agent-platform/ui";
import { formatSender } from "@/lib/conversation-options";

export function MessageTimeline({ messages }: { messages: MessageSummary[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isUser = message.senderType === "USER";
        const isAssistant = message.senderType === "ASSISTANT";
        const Icon = isUser ? CircleUserRound : isAssistant ? Bot : Info;
        const sources = readSources(message.metadata);
        return (
          <article
            key={message.id}
            className={cn(
              "flex gap-3",
              isUser ? "justify-end" : "justify-start",
              message.senderType === "SYSTEM" && "justify-center",
            )}
          >
            {!isUser ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
            <div
              className={cn(
                "max-w-2xl rounded-md border px-4 py-3 text-sm shadow-sm",
                isUser
                  ? "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100"
                  : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
                message.senderType === "SYSTEM" && "max-w-xl bg-zinc-50 text-zinc-600",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-4 text-xs text-zinc-500">
                <span>{formatSender(message.senderType)}</span>
                <time>{new Date(message.createdAt).toLocaleString()}</time>
              </div>
              <p className="whitespace-pre-wrap leading-6">{message.content}</p>
              {sources.length > 0 ? (
                <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <p className="mb-2 text-xs font-medium text-zinc-500">Sources</p>
                  <div className="space-y-2">
                    {sources.map((source) => {
                      const SourceIcon =
                        source.sourceType === "document"
                          ? FileText
                          : source.sourceType === "website"
                            ? Globe2
                            : HelpCircle;
                      return (
                        <div
                          key={`${source.sourceType}-${source.sourceId}-${source.chunkReference}`}
                          className="flex items-center gap-2 text-xs text-zinc-500"
                        >
                          <SourceIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="truncate">{source.sourceName}</span>
                          <span>{(source.relevanceScore * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
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
