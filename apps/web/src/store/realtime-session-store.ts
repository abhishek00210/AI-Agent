"use client";

import type { RealtimeSessionSummary } from "@ai-agent-platform/types";
import { create } from "zustand";

interface RealtimeSessionState {
  sessions: RealtimeSessionSummary[];
  selectedSession: RealtimeSessionSummary | null;
  loading: boolean;
  setSessions: (sessions: RealtimeSessionSummary[]) => void;
  setSelectedSession: (session: RealtimeSessionSummary | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useRealtimeSessionStore = create<RealtimeSessionState>((set) => ({
  sessions: [],
  selectedSession: null,
  loading: false,
  setSessions: (sessions) => set({ sessions }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setLoading: (loading) => set({ loading }),
}));
