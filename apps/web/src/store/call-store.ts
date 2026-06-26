"use client";

import type {
  CallDetails,
  CallDirection,
  CallEndReason,
  CallListResponse,
  CallSource,
  CallStatus,
} from "@ai-agent-platform/types";
import { create } from "zustand";

interface CallState {
  calls: CallListResponse | null;
  selectedCall: CallDetails | null;
  page: number;
  limit: number;
  search: string;
  status: CallStatus | "ALL";
  direction: CallDirection | "ALL";
  source: CallSource | "ALL";
  endReason: CallEndReason | "ALL";
  loading: boolean;
  setCalls: (calls: CallListResponse | null) => void;
  setSelectedCall: (call: CallDetails | null) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: CallStatus | "ALL") => void;
  setDirection: (direction: CallDirection | "ALL") => void;
  setSource: (source: CallSource | "ALL") => void;
  setEndReason: (endReason: CallEndReason | "ALL") => void;
  setLoading: (loading: boolean) => void;
}

export const useCallStore = create<CallState>((set) => ({
  calls: null,
  selectedCall: null,
  page: 1,
  limit: 20,
  search: "",
  status: "ALL",
  direction: "ALL",
  source: "ALL",
  endReason: "ALL",
  loading: false,
  setCalls: (calls) => set({ calls }),
  setSelectedCall: (selectedCall) => set({ selectedCall }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setDirection: (direction) => set({ direction, page: 1 }),
  setSource: (source) => set({ source, page: 1 }),
  setEndReason: (endReason) => set({ endReason, page: 1 }),
  setLoading: (loading) => set({ loading }),
}));
