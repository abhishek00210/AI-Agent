"use client";

import type { ConversationMemoryResponse } from "@ai-agent-platform/types";
import { create } from "zustand";

interface MemoryState {
  selectedMemory: ConversationMemoryResponse | null;
  isRefreshing: boolean;
  setSelectedMemory: (memory: ConversationMemoryResponse | null) => void;
  setRefreshing: (isRefreshing: boolean) => void;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  selectedMemory: null,
  isRefreshing: false,
  setSelectedMemory: (selectedMemory) => set({ selectedMemory }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
}));
