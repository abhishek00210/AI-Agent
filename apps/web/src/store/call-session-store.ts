"use client";

import type { CallSessionSummary } from "@ai-agent-platform/types";
import { create } from "zustand";

interface CallSessionState {
  sessions: CallSessionSummary[];
  selectedSession: CallSessionSummary | null;
  loading: boolean;
  setSessions: (sessions: CallSessionSummary[]) => void;
  setSelectedSession: (session: CallSessionSummary | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useCallSessionStore = create<CallSessionState>((set) => ({
  sessions: [],
  selectedSession: null,
  loading: false,
  setSessions: (sessions) => set({ sessions }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setLoading: (loading) => set({ loading }),
}));
