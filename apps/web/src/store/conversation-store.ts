"use client";

import type {
  ConversationAnalytics,
  ConversationDetails,
  ConversationListResponse,
  ConversationStatus,
  MessageListResponse,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface ConversationState {
  conversations: ConversationListResponse | null;
  selectedConversation: ConversationDetails | null;
  messages: MessageListResponse | null;
  analytics: ConversationAnalytics | null;
  page: number;
  limit: number;
  search: string;
  status: ConversationStatus | "ALL";
  setConversations: (conversations: ConversationListResponse | null) => void;
  setSelectedConversation: (conversation: ConversationDetails | null) => void;
  setMessages: (messages: MessageListResponse | null) => void;
  setAnalytics: (analytics: ConversationAnalytics | null) => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: ConversationStatus | "ALL") => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: null,
  selectedConversation: null,
  messages: null,
  analytics: null,
  page: 1,
  limit: 10,
  search: "",
  status: "ALL",
  setConversations: (conversations) => set({ conversations }),
  setSelectedConversation: (selectedConversation) => set({ selectedConversation }),
  setMessages: (messages) => set({ messages }),
  setAnalytics: (analytics) => set({ analytics }),
  setPage: (page) => set({ page }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
}));
