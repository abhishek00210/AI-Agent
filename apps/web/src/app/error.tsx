"use client";

import { Button } from "@ai-agent-platform/ui";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <section className="max-w-md space-y-4">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Application error</p>
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          The workspace could not load.
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{error.message}</p>
        <Button onClick={reset}>Retry</Button>
      </section>
    </main>
  );
}
