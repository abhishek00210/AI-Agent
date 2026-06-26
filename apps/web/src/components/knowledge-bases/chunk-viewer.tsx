"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import React from "react";
import { Button } from "@ai-agent-platform/ui";
import { authApi } from "@/lib/auth-api";
import { useEmbeddingStore } from "@/store/embedding-store";

export function ChunkViewer({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const page = useEmbeddingStore((state) => state.chunkPage);
  const search = useEmbeddingStore((state) => state.chunkSearch);
  const setChunks = useEmbeddingStore((state) => state.setChunks);
  const setPage = useEmbeddingStore((state) => state.setChunkPage);
  const setSearch = useEmbeddingStore((state) => state.setChunkSearch);
  const [searchInput, setSearchInput] = React.useState(search);
  const limit = 10;

  const query = useQuery({
    queryKey: ["embedding-chunks", knowledgeBaseId, { page, search }],
    queryFn: async () => {
      const result = await authApi.knowledgeChunks(knowledgeBaseId, {
        page,
        limit,
        search: search || undefined,
      });
      setChunks(result);
      return result;
    },
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-6 dark:border-zinc-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">Chunk viewer</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Admin debug view for chunk text, token counts, metadata, and embedding records.
          </p>
        </div>
        <form className="relative w-full max-w-sm" onSubmit={applySearch}>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Search chunks"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </form>
      </div>

      {query.error ? (
        <div className="m-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {query.error instanceof Error ? query.error.message : "Unable to load chunks."}
        </div>
      ) : null}

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {query.isLoading ? (
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Loading chunks...</div>
        ) : null}
        {query.data?.data.map((chunk) => (
          <article key={chunk.id} className="p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold">Chunk #{chunk.chunkIndex + 1}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {chunk.tokenCount} tokens · {chunk.embedding ? "Embedded" : "No embedding"}
              </div>
            </div>
            <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {chunk.chunkText}
            </p>
            {chunk.embedding ? (
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {chunk.embedding.embeddingModel} · {chunk.embedding.dimensions} dimensions
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!query.isLoading && query.data?.data.length === 0 ? (
        <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
          No chunks generated yet. Process a document or website to populate this view.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-zinc-200 px-6 py-4 text-sm dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-zinc-500 dark:text-zinc-400">
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
  );
}
