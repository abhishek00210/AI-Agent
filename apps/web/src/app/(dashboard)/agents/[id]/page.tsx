"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarDays,
  Copy,
  MessageCircle,
  MessageSquare,
  Pencil,
  PhoneCall,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { AgentKnowledgeTestPanel } from "@/components/agents/agent-knowledge-test-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoader } from "@/components/layout/page-loader";
import { formatAgentLanguage, formatAgentStatus, formatAgentVoice } from "@/lib/agent-options";
import { authApi } from "@/lib/auth-api";
import { useAgentStore } from "@/store/agent-store";

const futureSections = [
  { label: "Knowledge Base", icon: BookOpen },
  { label: "Conversations", icon: MessageSquare },
  { label: "Calls", icon: PhoneCall },
  { label: "Appointments", icon: CalendarDays },
  { label: "Analytics", icon: BarChart3 },
];

export default function AgentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSelectedAgent = useAgentStore((state) => state.setSelectedAgent);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const agentId = params.id;

  const agentQuery = useQuery({
    queryKey: ["agents", agentId],
    queryFn: async () => {
      const agent = await authApi.agent(agentId);
      setSelectedAgent(agent);
      return agent;
    },
  });

  const duplicateAgent = useMutation({
    mutationFn: authApi.duplicateAgent,
    onSuccess: (agent) => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      router.push(`/agents/${agent.id}`);
    },
  });

  const deleteAgent = useMutation({
    mutationFn: authApi.deleteAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      router.push("/agents");
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

  const agent = agentQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={agent.name}
        description="Agent details are scoped to the current organization."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/agents">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All Agents
              </Link>
            </Button>
            <Button variant="outline" onClick={() => duplicateAgent.mutate(agent.id)}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Duplicate
            </Button>
            <Button asChild>
              <Link href={`/agents/${agent.id}/test`}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Test Agent
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/agents/${agent.id}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Agent information</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <Detail label="Name" value={agent.name} />
            <Detail label="Description" value={agent.description ?? "No description"} />
            <Detail label="Language" value={formatAgentLanguage(agent.language)} />
            <Detail label="Voice" value={formatAgentVoice(agent.voice)} />
            <Detail label="Status" value={formatAgentStatus(agent.status)} />
            <Detail label="Created Date" value={new Date(agent.createdAt).toLocaleString()} />
            <Detail label="Updated Date" value={new Date(agent.updatedAt).toLocaleString()} />
          </dl>
          <Button className="mt-6" variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Agent
          </Button>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">System prompt</h2>
          <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            {agent.systemPrompt}
          </pre>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {futureSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.label}
              className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">{section.label}</h3>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Future integration placeholder.
              </p>
            </div>
          );
        })}
      </section>

      <AgentKnowledgeTestPanel agentId={agent.id} />

      <EmptyState
        icon={BookOpen}
        title="Integration modules are ready to connect"
        description="Knowledge base, conversations, calls, appointments, and analytics can attach to this tenant-scoped agent record."
      />

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold">Delete agent</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Are you sure you want to delete this agent?
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              This action can be restored later.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => deleteAgent.mutate(agent.id)} disabled={deleteAgent.isPending}>
                {deleteAgent.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
