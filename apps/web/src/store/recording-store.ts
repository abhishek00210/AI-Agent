"use client";

import type {
  CallRecordingDetails,
  CallRecordingListResponse,
  RecordingStatus,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface RecordingState {
  recordings: CallRecordingListResponse | null;
  selectedRecording: CallRecordingDetails | null;
  page: number;
  limit: number;
  search: string;
  status: RecordingStatus | "ALL";
  loading: boolean;
  setRecordings: (recordings: CallRecordingListResponse | null) => void;
  setSelectedRecording: (recording: CallRecordingDetails | null) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: RecordingStatus | "ALL") => void;
  setLoading: (loading: boolean) => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  recordings: null,
  selectedRecording: null,
  page: 1,
  limit: 20,
  search: "",
  status: "ALL",
  loading: false,
  setRecordings: (recordings) => set({ recordings }),
  setSelectedRecording: (selectedRecording) => set({ selectedRecording }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setLoading: (loading) => set({ loading }),
}));
