"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateAgentInput } from "@ai-agent-platform/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { AgentForm } from "@/components/agents/agent-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useAgentStore } from "@/store/agent-store";

export default function EditAgentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSelectedAgent = useAgentStore((state) => state.setSelectedAgent);
  const [notice, setNotice] = useState<string | null>(null);
  const agentId = params.id;

  const agentQuery = useQuery({
    queryKey: ["agents", agentId],
    queryFn: async () => {
      const agent = await authApi.agent(agentId);
      setSelectedAgent(agent);
      return agent;
    },
  });

  const updateAgent = useMutation({
    mutationFn: (values: CreateAgentInput) => authApi.updateAgent(agentId, values),
    onSuccess: (agent) => {
      setNotice("Agent saved.");
      setSelectedAgent(agent);
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["agents", agentId] });
    },
  });

  if (agentQuery.isLoading) {
    return <PageLoader label="Loading agent..." />;
  }

  if (agentQuery.error || !agentQuery.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        {agentQuery.error instanceof Error ? agentQuery.error.message : "Agent not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Agent"
        description="Update agent configuration without changing tenant ownership."
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/agents/${agentId}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                View Agent
              </Link>
            </Button>
            <Button variant="outline" onClick={() => router.push("/agents")}>
              All Agents
            </Button>
          </div>
        }
      />
      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
          {notice}
        </div>
      ) : null}
      {updateAgent.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {updateAgent.error instanceof Error ? updateAgent.error.message : "Unable to save agent."}
        </div>
      ) : null}
      <AgentForm
        agent={agentQuery.data}
        submitLabel="Save Changes"
        isSubmitting={updateAgent.isPending}
        onSubmit={(values) => updateAgent.mutate(values)}
      />
    </div>
  );
}
