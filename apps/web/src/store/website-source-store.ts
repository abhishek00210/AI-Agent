"use client";

import type {
  WebsiteSourceDetails,
  WebsiteSourceListResponse,
  WebsiteSourceStatus,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface WebsiteSourceState {
  websiteSources: WebsiteSourceListResponse | null;
  selectedWebsiteSource: WebsiteSourceDetails | null;
  page: number;
  limit: number;
  search: string;
  status: WebsiteSourceStatus | "ALL";
  knowledgeBaseId: string;
  setWebsiteSources: (websiteSources: WebsiteSourceListResponse) => void;
  setSelectedWebsiteSource: (websiteSource: WebsiteSourceDetails | null) => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: WebsiteSourceStatus | "ALL") => void;
  setKnowledgeBaseId: (knowledgeBaseId: string) => void;
}

export const useWebsiteSourceStore = create<WebsiteSourceState>((set) => ({
  websiteSources: null,
  selectedWebsiteSource: null,
  page: 1,
  limit: 10,
  search: "",
  status: "ALL",
  knowledgeBaseId: "",
  setWebsiteSources: (websiteSources) => set({ websiteSources }),
  setSelectedWebsiteSource: (selectedWebsiteSource) => set({ selectedWebsiteSource }),
  setPage: (page) => set({ page }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setKnowledgeBaseId: (knowledgeBaseId) => set({ knowledgeBaseId, page: 1 }),
}));
