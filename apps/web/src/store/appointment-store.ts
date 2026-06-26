import type { AppointmentListResponse, AppointmentStatus } from "@ai-agent-platform/types";
import { create } from "zustand";

interface AppointmentState {
  appointments: AppointmentListResponse | null;
  search: string;
  status: "ALL" | AppointmentStatus;
  loading: boolean;
  setAppointments: (appointments: AppointmentListResponse | null) => void;
  setSearch: (search: string) => void;
  setStatus: (status: "ALL" | AppointmentStatus) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: null,
  search: "",
  status: "ALL",
  loading: false,
  setAppointments: (appointments) => set({ appointments }),
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
}));
