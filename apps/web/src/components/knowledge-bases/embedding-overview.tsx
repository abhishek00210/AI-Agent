"use client";

import type { EmbeddingStats } from "@ai-agent-platform/types";
import { BarChart3, Boxes, Database, FileText, Globe2, XCircle } from "lucide-react";

export function EmbeddingOverview({ stats }: { stats?: EmbeddingStats }) {
  const items = [
    { label: "Documents", value: stats?.totalDocuments ?? 0, icon: FileText },
    { label: "Websites", value: stats?.totalWebsites ?? 0, icon: Globe2 },
    { label: "Chunks", value: stats?.totalChunks ?? 0, icon: Boxes },
    { label: "Embeddings", value: stats?.totalEmbeddings ?? 0, icon: Database },
    { label: "Processed Sources", value: stats?.processedSources ?? 0, icon: BarChart3 },
    { label: "Failed Sources", value: stats?.failedSources ?? 0, icon: XCircle },
  ];

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Embedding overview</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Processing statistics for this knowledge base.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <item.icon className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
            <div className="mt-3 text-2xl font-semibold">{item.value.toLocaleString()}</div>
            <div className="mt-1 text-xs uppercase text-zinc-500 dark:text-zinc-400">
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {stats?.models.length ? (
        <div className="mt-5 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h3 className="font-medium">Embedding analytics</h3>
          <div className="mt-3 grid gap-2">
            {stats.models.map((model) => (
              <div
                key={`${model.embeddingModel}-${model.dimensions}`}
                className="flex flex-col gap-1 text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{model.embeddingModel}</span>
                <span>
                  {model.totalEmbeddings.toLocaleString()} embeddings · {model.dimensions} dims
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
