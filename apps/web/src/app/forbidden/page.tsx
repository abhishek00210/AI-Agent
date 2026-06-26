import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@ai-agent-platform/ui";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <section className="max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-medium text-teal-700 dark:text-teal-300">403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          Access restricted
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Your current role does not have permission to access this workspace area.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
