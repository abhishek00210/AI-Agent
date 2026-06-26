"use client";

import type { AuthUser, CurrentOrganization } from "@ai-agent-platform/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  currentOrganization: CurrentOrganization | null;
  hydrated: boolean;
  setSession: (session: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setCurrentOrganization: (organization: CurrentOrganization | null) => void;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      currentOrganization: null,
      hydrated: false,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user,
        }),
      setCurrentOrganization: (organization) => set({ currentOrganization: organization }),
      clearSession: () =>
        set({ accessToken: null, refreshToken: null, user: null, currentOrganization: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "ai-agent-platform-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        currentOrganization: state.currentOrganization,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
          return;
        }

        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);
