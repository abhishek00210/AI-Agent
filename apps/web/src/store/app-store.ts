import { create } from "zustand";

interface AppState {
  mobileSidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  mobileSidebarOpen: false,
  sidebarCollapsed: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
