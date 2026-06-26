"use client";

import type { SendChatMessageResponse, TokenUsage } from "@ai-agent-platform/types";
import { create } from "zustand";

interface ChatState {
  latestResponse: SendChatMessageResponse | null;
  tokenUsage: TokenUsage | null;
  responseMetadata: {
    model: string;
    responseTime: number;
    retrievalCount: number;
  } | null;
  streaming: boolean;
  setLatestResponse: (response: SendChatMessageResponse | null) => void;
  setStreaming: (streaming: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  latestResponse: null,
  tokenUsage: null,
  responseMetadata: null,
  streaming: false,
  setLatestResponse: (latestResponse) =>
    set({
      latestResponse,
      tokenUsage: latestResponse?.tokenUsage ?? null,
      responseMetadata: latestResponse
        ? {
            model: latestResponse.model,
            responseTime: latestResponse.responseTime,
            retrievalCount: latestResponse.metadata.retrievalCount,
          }
        : null,
    }),
  setStreaming: (streaming) => set({ streaming }),
}));
