"use client";

import { Button } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileText, RefreshCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function TranscriptDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const transcript = useQuery({
    queryKey: ["voice-transcript", params.id],
    queryFn: () => authApi.callTranscript(params.id),
    refetchInterval: (query) =>
      ["PENDING", "PROCESSING"].includes(query.state.data?.status ?? "") ? 3000 : false,
  });
  const segments = useQuery({
    queryKey: ["voice-transcript-segments", params.id],
    queryFn: () => authApi.callTranscriptSegments(params.id),
    enabled: transcript.data?.status === "COMPLETED",
  });
  const reprocess = useMutation({
    mutationFn: authApi.reprocessCallTranscript,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["voice-transcript", params.id] });
      await queryClient.invalidateQueries({
        queryKey: ["voice-transcript-segments", params.id],
      });
    },
  });

  if (transcript.isLoading) {
    return <SkeletonBlock className="h-[32rem] w-full" />;
  }
  if (!transcript.data) {
    return (
      <EmptyState
        icon={FileText}
        title="Transcript not found"
        description="This transcript may belong to another workspace."
      />
    );
  }

  const data = transcript.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Transcript"
        description={`${data.call?.callerNumber ?? "Caller"} to ${data.call?.calledNumber ?? "voice agent"}`}
        action={
          <Button
            variant="outline"
            disabled={reprocess.isPending || data.status === "PROCESSING"}
            onClick={() => reprocess.mutate(data.id)}
          >
            <RefreshCcw className="h-4 w-4" />
            Reprocess
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Status" value={data.status} />
        <Metric label="Words" value={data.wordCount.toLocaleString()} />
        <Metric label="Segments" value={String(data.segmentCount)} />
        <Metric
          label="Confidence"
          value={data.confidence == null ? "Unavailable" : `${Math.round(data.confidence * 100)}%`}
        />
      </section>

      {data.failureReason ? (
        <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{data.failureReason}</p>
        </div>
      ) : null}

      <section className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">AI Summary</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {data.summary ?? "Summary will appear after transcription completes."}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Transcript Timeline</h2>
        <div className="mt-5 space-y-4">
          {segments.isLoading ? <SkeletonBlock className="h-48 w-full" /> : null}
          {segments.data?.map((segment) => (
            <div
              key={segment.id}
              className="grid gap-2 border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-900 md:grid-cols-[7rem_1fr]"
            >
              <div>
                <SpeakerBadge speaker={segment.speaker} />
                <p className="mt-2 text-xs text-zinc-500">{formatTimestamp(segment.startMs)}</p>
              </div>
              <div>
                <p className="text-sm leading-6">{segment.text}</p>
                {segment.confidence != null ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Confidence {Math.round(segment.confidence * 100)}%
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {!segments.isLoading && segments.data?.length === 0 ? (
            <p className="text-sm text-zinc-500">No transcript segments are available yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SpeakerBadge({ speaker }: { speaker: string }) {
  const color =
    speaker === "USER"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      : speaker === "ASSISTANT"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
  return <span className={`rounded px-2 py-1 text-xs font-medium ${color}`}>{speaker}</span>;
}

function formatTimestamp(milliseconds: number) {
  const total = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
