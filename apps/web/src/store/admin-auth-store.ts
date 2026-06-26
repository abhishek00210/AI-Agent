"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN";
}

interface AdminAuthState {
  accessToken: string | null;
  admin: AdminUser | null;
  hydrated: boolean;
  setSession: (session: { accessToken: string; admin: AdminUser }) => void;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      admin: null,
      hydrated: false,
      setSession: (session) => set({ accessToken: session.accessToken, admin: session.admin }),
      clearSession: () => set({ accessToken: null, admin: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "ai-agent-platform-super-admin",
      partialize: (state) => ({ accessToken: state.accessToken, admin: state.admin }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated(true);
        else useAdminAuthStore.setState({ hydrated: true });
      },
    },
  ),
);
