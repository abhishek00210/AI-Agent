"use client";

import { Button } from "@ai-agent-platform/ui";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold">Dashboard error</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        The dashboard route failed to render.
      </p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
