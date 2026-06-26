import type { AgentDetails, AgentListResponse, AgentStatus } from "@ai-agent-platform/types";
import { create } from "zustand";

interface AgentState {
  agents: AgentListResponse | null;
  selectedAgent: AgentDetails | null;
  page: number;
  limit: number;
  search: string;
  status: AgentStatus | "ALL";
  loading: boolean;
  setAgents: (agents: AgentListResponse | null) => void;
  setSelectedAgent: (agent: AgentDetails | null) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: AgentStatus | "ALL") => void;
  setLoading: (loading: boolean) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: null,
  selectedAgent: null,
  page: 1,
  limit: 10,
  search: "",
  status: "ALL",
  loading: false,
  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setLoading: (loading) => set({ loading }),
}));
