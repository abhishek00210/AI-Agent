"use client";

import type { TranscriptStatus } from "@ai-agent-platform/types";
import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useTranscriptStore } from "@/store/transcript-store";

const statuses: Array<TranscriptStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
];

export default function TranscriptsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TranscriptStatus | "ALL">("ALL");
  const transcripts = useQuery({
    queryKey: ["voice-transcripts", { search, status }],
    queryFn: () =>
      authApi.callTranscripts({
        search,
        status: status === "ALL" ? undefined : status,
        page: 1,
        limit: 20,
      }),
    refetchInterval: (query) =>
      query.state.data?.data.some((item) => ["PENDING", "PROCESSING"].includes(item.status))
        ? 3000
        : false,
  });
  const reprocess = useMutation({
    mutationFn: authApi.reprocessCallTranscript,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice-transcripts"] }),
  });
  const setTranscripts = useTranscriptStore((state) => state.setTranscripts);
  const setLoading = useTranscriptStore((state) => state.setLoading);

  useEffect(() => {
    setTranscripts(transcripts.data ?? null);
    setLoading(transcripts.isLoading);
  }, [setLoading, setTranscripts, transcripts.data, transcripts.isLoading]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transcripts"
        description="Search speaker-separated call transcripts and review automated summaries."
      />

      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transcript content"
              className="h-9 w-full rounded-md border border-zinc-200 bg-transparent pl-9 pr-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TranscriptStatus | "ALL")}
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All statuses" : item}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Call</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Words</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Completed</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transcripts.isLoading ? <RowsSkeleton /> : null}
              {transcripts.data?.data.map((transcript) => (
                <tr
                  key={transcript.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-4">
                    <Link
                      href={`/voice/transcripts/${transcript.id}`}
                      className="font-medium hover:underline"
                    >
                      {transcript.call?.callerNumber ?? transcript.callId}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">{transcript.call?.calledNumber}</p>
                  </td>
                  <td className="px-4 py-4">{transcript.call?.agent.name ?? "Unknown"}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={transcript.status} />
                  </td>
                  <td className="px-4 py-4">{transcript.wordCount.toLocaleString()}</td>
                  <td className="px-4 py-4">{formatConfidence(transcript.confidence)}</td>
                  <td className="px-4 py-4">
                    {transcript.completedAt
                      ? new Date(transcript.completedAt).toLocaleString()
                      : "Pending"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/voice/transcripts/${transcript.id}`}>View</Link>
                      </Button>
                      {transcript.status === "FAILED" ? (
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={reprocess.isPending}
                          onClick={() => reprocess.mutate(transcript.id)}
                          aria-label="Retry transcription"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!transcripts.isLoading && transcripts.data?.data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No transcripts yet"
          description="Completed recordings are transcribed automatically in the background."
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: TranscriptStatus }) {
  const color =
    status === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return <span className={`rounded px-2 py-1 text-xs font-medium ${color}`}>{status}</span>;
}

function RowsSkeleton() {
  return Array.from({ length: 4 }, (_, index) => (
    <tr key={index}>
      <td colSpan={7} className="px-4 py-3">
        <SkeletonBlock className="h-8 w-full" />
      </td>
    </tr>
  ));
}

function formatConfidence(value: number | null) {
  return value == null ? "Unavailable" : `${Math.round(value * 100)}%`;
}
