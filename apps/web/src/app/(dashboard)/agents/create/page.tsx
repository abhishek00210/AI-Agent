"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateAgentInput } from "@ai-agent-platform/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ai-agent-platform/ui";
import { AgentForm } from "@/components/agents/agent-form";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

export default function CreateAgentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createAgent = useMutation({
    mutationFn: authApi.createAgent,
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      router.push(`/agents/${agent.id}`);
    },
  });

  function handleSubmit(values: CreateAgentInput) {
    createAgent.mutate(values);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Agent"
        description="Configure a tenant-scoped AI agent for future voice, chat, and knowledge workflows."
        action={
          <Button variant="outline" asChild>
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Agents
            </Link>
          </Button>
        }
      />
      {createAgent.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {createAgent.error instanceof Error
            ? createAgent.error.message
            : "Unable to create agent."}
        </div>
      ) : null}
      <AgentForm
        submitLabel="Create Agent"
        isSubmitting={createAgent.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
