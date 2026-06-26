"use client";

import type {
  FaqListResponse,
  RagAnalytics,
  RagAskResponse,
  RagSearchResponse,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface RagState {
  faqs: FaqListResponse | null;
  searchResult: RagSearchResponse | null;
  askResult: RagAskResponse | null;
  analytics: RagAnalytics | null;
  setFaqs: (faqs: FaqListResponse | null) => void;
  setSearchResult: (result: RagSearchResponse | null) => void;
  setAskResult: (result: RagAskResponse | null) => void;
  setAnalytics: (analytics: RagAnalytics | null) => void;
}

export const useRagStore = create<RagState>((set) => ({
  faqs: null,
  searchResult: null,
  askResult: null,
  analytics: null,
  setFaqs: (faqs) => set({ faqs }),
  setSearchResult: (searchResult) => set({ searchResult }),
  setAskResult: (askResult) => set({ askResult }),
  setAnalytics: (analytics) => set({ analytics }),
}));
