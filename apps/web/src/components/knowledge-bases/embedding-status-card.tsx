"use client";

import type { EmbeddingSourceStatus } from "@ai-agent-platform/types";
import { Database, RefreshCw } from "lucide-react";
import type React from "react";
import { Button, cn } from "@ai-agent-platform/ui";
import { embeddingStatusTone, formatEmbeddingStatus } from "@/lib/embedding-options";

export function EmbeddingStatusCard({
  status,
  isProcessing,
  onProcess,
}: {
  status?: EmbeddingSourceStatus;
  isProcessing?: boolean;
  onProcess: () => void;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Database className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold">Embedding processing</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Chunk and embed this source for future semantic search and RAG workflows.
          </p>
        </div>
        <Button onClick={onProcess} disabled={isProcessing}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {isProcessing ? "Queuing..." : status?.status === "FAILED" ? "Retry" : "Process"}
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Status"
          value={
            status ? (
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                  embeddingStatusTone(status.status),
                )}
              >
                {formatEmbeddingStatus(status.status)}
              </span>
            ) : (
              "Not checked"
            )
          }
        />
        <Metric label="Chunks" value={String(status?.chunkCount ?? 0)} />
        <Metric label="Embeddings" value={String(status?.embeddingCount ?? 0)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs uppercase text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}
