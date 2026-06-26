"use client";

import type {
  EmbeddingSourceStatus,
  EmbeddingStats,
  KnowledgeChunkListResponse,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface EmbeddingState {
  stats: EmbeddingStats | null;
  sourceStatus: EmbeddingSourceStatus | null;
  chunks: KnowledgeChunkListResponse | null;
  chunkPage: number;
  chunkSearch: string;
  setStats: (stats: EmbeddingStats | null) => void;
  setSourceStatus: (status: EmbeddingSourceStatus | null) => void;
  setChunks: (chunks: KnowledgeChunkListResponse | null) => void;
  setChunkPage: (page: number) => void;
  setChunkSearch: (search: string) => void;
}

export const useEmbeddingStore = create<EmbeddingState>((set) => ({
  stats: null,
  sourceStatus: null,
  chunks: null,
  chunkPage: 1,
  chunkSearch: "",
  setStats: (stats) => set({ stats }),
  setSourceStatus: (sourceStatus) => set({ sourceStatus }),
  setChunks: (chunks) => set({ chunks }),
  setChunkPage: (chunkPage) => set({ chunkPage }),
  setChunkSearch: (chunkSearch) => set({ chunkSearch, chunkPage: 1 }),
}));
