"use client";

import type {
  CallTranscriptDetails,
  CallTranscriptListResponse,
  CallTranscriptSegment,
  TranscriptStatus,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface TranscriptState {
  transcripts: CallTranscriptListResponse | null;
  selectedTranscript: CallTranscriptDetails | null;
  segments: CallTranscriptSegment[];
  search: string;
  status: TranscriptStatus | "ALL";
  loading: boolean;
  setTranscripts: (value: CallTranscriptListResponse | null) => void;
  setSelectedTranscript: (value: CallTranscriptDetails | null) => void;
  setSegments: (value: CallTranscriptSegment[]) => void;
  setSearch: (value: string) => void;
  setStatus: (value: TranscriptStatus | "ALL") => void;
  setLoading: (value: boolean) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  transcripts: null,
  selectedTranscript: null,
  segments: [],
  search: "",
  status: "ALL",
  loading: false,
  setTranscripts: (transcripts) => set({ transcripts }),
  setSelectedTranscript: (selectedTranscript) => set({ selectedTranscript }),
  setSegments: (segments) => set({ segments }),
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
}));
