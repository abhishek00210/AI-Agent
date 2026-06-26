import type { RagRetrievedChunk, RagSourceCitation } from "@ai-agent-platform/types";
import { FileText, Globe2, HelpCircle } from "lucide-react";

export function RagResults({
  answer,
  confidence,
  sources,
  chunks,
}: {
  answer: string;
  confidence: number;
  sources: RagSourceCitation[];
  chunks: RagRetrievedChunk[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Generated answer</h2>
            <span className="text-xs text-zinc-500">
              Confidence {(confidence * 100).toFixed(1)}%
            </span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
            {answer}
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Retrieved knowledge</h2>
          {chunks.map((chunk) => (
            <article
              key={chunk.chunkId}
              className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                <span>
                  {chunk.sourceName} · Chunk {chunk.chunkIndex + 1}
                </span>
                <span>{(chunk.relevanceScore * 100).toFixed(1)}% match</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {chunk.chunkText}
              </p>
            </article>
          ))}
        </section>
      </div>
      <section className="h-fit rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Sources</h2>
        <div className="mt-4 space-y-3">
          {sources.map((source) => {
            const Icon =
              source.sourceType === "document"
                ? FileText
                : source.sourceType === "website"
                  ? Globe2
                  : HelpCircle;
            return (
              <div
                key={`${source.sourceType}-${source.sourceId}-${source.chunkReference}`}
                className="flex gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <Icon className="mt-0.5 h-4 w-4 text-teal-700" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source.sourceName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {source.sourceType} · {(source.relevanceScore * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })}
          {sources.length === 0 ? (
            <p className="text-sm text-zinc-500">No relevant sources were found.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
