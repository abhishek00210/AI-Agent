"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useAuthStore } from "@/store/auth-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((state) => state.hydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setHydrated = useAuthStore((state) => state.setHydrated);

  React.useEffect(() => {
    if (!hydrated && useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
  }, [hydrated, setHydrated]);

  React.useEffect(() => {
    if (hydrated) {
      return;
    }

    const timer = window.setTimeout(() => setHydrated(true), 750);
    return () => window.clearTimeout(timer);
  }, [hydrated, setHydrated]);

  React.useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [accessToken, hydrated, pathname, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
        Checking session...
      </div>
    );
  }

  return children;
}
