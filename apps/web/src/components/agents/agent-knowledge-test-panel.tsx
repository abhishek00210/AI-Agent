"use client";

import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { RagResults } from "@/components/knowledge-bases/rag-results";
import { authApi } from "@/lib/auth-api";
import { useRagStore } from "@/store/rag-store";

export function AgentKnowledgeTestPanel({ agentId }: { agentId: string }) {
  const [question, setQuestion] = useState("");
  const askResult = useRagStore((state) => state.askResult);
  const setAskResult = useRagStore((state) => state.setAskResult);
  const ask = useMutation({
    mutationFn: authApi.askRag,
    onSuccess: setAskResult,
  });

  return (
    <section className="space-y-4 rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-base font-semibold">Knowledge testing</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ask this agent a question and inspect the retrieved sources before enabling chat or voice.
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) {
            ask.mutate({ agentId, question: question.trim() });
          }
        }}
      >
        <textarea
          className="min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="Ask a question this agent should answer from its assigned knowledge bases."
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={ask.isPending || question.trim().length < 2}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {ask.isPending ? "Asking..." : "Ask Agent"}
          </Button>
        </div>
      </form>
      {ask.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {ask.error instanceof Error ? ask.error.message : "Unable to ask agent."}
        </div>
      ) : null}
      {askResult ? (
        <RagResults
          answer={askResult.answer}
          confidence={askResult.confidence}
          sources={askResult.sources}
          chunks={askResult.retrievedChunks}
        />
      ) : null}
    </section>
  );
}
