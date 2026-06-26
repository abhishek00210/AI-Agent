"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAdminAuthStore((state) => state.hydrated);
  const token = useAdminAuthStore((state) => state.accessToken);
  const setHydrated = useAdminAuthStore((state) => state.setHydrated);

  React.useEffect(() => {
    if (!hydrated && useAdminAuthStore.persist.hasHydrated()) setHydrated(true);
  }, [hydrated, setHydrated]);

  React.useEffect(() => {
    if (hydrated && !token) router.replace(`/admin-login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, pathname, router, token]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        Checking super admin session...
      </div>
    );
  }
  return children;
}
