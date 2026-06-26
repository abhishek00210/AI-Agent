"use client";

import type {
  ConversationDetails,
  RagRetrievedChunk,
  RagSourceCitation,
  SendChatMessageResponse,
  TokenUsage,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface AgentTestState {
  activeConversationId: string | null;
  selectedConversation: ConversationDetails | null;
  latestResponse: SendChatMessageResponse | null;
  latestSources: RagSourceCitation[];
  latestChunks: RagRetrievedChunk[];
  sessionTokenUsage: TokenUsage;
  setActiveConversationId: (conversationId: string | null) => void;
  setSelectedConversation: (conversation: ConversationDetails | null) => void;
  setLatestResponse: (response: SendChatMessageResponse | null) => void;
  resetSessionAnalytics: () => void;
}

const emptyTokenUsage: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export const useAgentTestStore = create<AgentTestState>((set) => ({
  activeConversationId: null,
  selectedConversation: null,
  latestResponse: null,
  latestSources: [],
  latestChunks: [],
  sessionTokenUsage: emptyTokenUsage,
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
  setSelectedConversation: (selectedConversation) => set({ selectedConversation }),
  setLatestResponse: (latestResponse) =>
    set((state) => ({
      latestResponse,
      latestSources: latestResponse?.sources ?? [],
      latestChunks: latestResponse?.retrievedChunks ?? [],
      sessionTokenUsage: latestResponse
        ? {
            promptTokens:
              state.sessionTokenUsage.promptTokens + latestResponse.tokenUsage.promptTokens,
            completionTokens:
              state.sessionTokenUsage.completionTokens + latestResponse.tokenUsage.completionTokens,
            totalTokens:
              state.sessionTokenUsage.totalTokens + latestResponse.tokenUsage.totalTokens,
          }
        : state.sessionTokenUsage,
    })),
  resetSessionAnalytics: () =>
    set({
      latestResponse: null,
      latestSources: [],
      latestChunks: [],
      sessionTokenUsage: emptyTokenUsage,
    }),
}));
