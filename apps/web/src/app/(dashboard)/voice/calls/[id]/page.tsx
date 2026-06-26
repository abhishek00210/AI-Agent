"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck,
  Clock3,
  Download,
  FileAudio,
  FileText,
  PhoneCall,
  Radio,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useCallSessionStore } from "@/store/call-session-store";
import { useCallStore } from "@/store/call-store";
import { useRealtimeSessionStore } from "@/store/realtime-session-store";

export default function CallDetailsPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const call = useQuery({
    queryKey: ["voice-call", params.id],
    queryFn: () => authApi.call(params.id),
  });
  const sessions = useQuery({
    queryKey: ["voice-call-sessions", params.id],
    queryFn: () => authApi.callSessions(params.id),
  });
  const timeline = useQuery({
    queryKey: ["voice-call-timeline", params.id],
    queryFn: () => authApi.callTimeline(params.id),
  });
  const summary = useQuery({
    queryKey: ["voice-call-summary", params.id],
    queryFn: () => authApi.callSummary(params.id),
    refetchInterval: (query) =>
      call.data?.status === "COMPLETED" && !query.state.data ? 5000 : false,
  });
  const realtimeSessions = useQuery({
    queryKey: ["voice-call-realtime-sessions", params.id],
    queryFn: () => authApi.callRealtimeSessions(params.id),
    refetchInterval: (query) =>
      query.state.data?.some((session) => ["CONNECTING", "CONNECTED"].includes(session.status))
        ? 3000
        : false,
  });
  const recordings = useQuery({
    queryKey: ["voice-call-recordings", params.id],
    queryFn: () => authApi.callRecordings({ callId: params.id }),
    refetchInterval: (query) =>
      query.state.data?.data.some((recording) =>
        ["PENDING", "RECORDING", "PROCESSING"].includes(recording.status),
      )
        ? 3000
        : false,
  });
  const transcript = useQuery({
    queryKey: ["voice-call-transcript", params.id],
    queryFn: () => authApi.callTranscriptByCall(params.id),
    refetchInterval: (query) =>
      ["PENDING", "PROCESSING"].includes(query.state.data?.status ?? "") ? 3000 : false,
  });
  const toolExecutions = useQuery({
    queryKey: ["voice-call-tool-executions", params.id],
    queryFn: () => authApi.toolExecutions({ callId: params.id, limit: 10 }),
  });
  const appointments = useQuery({
    queryKey: ["voice-call-appointments", params.id],
    queryFn: () => authApi.appointments({ callId: params.id, limit: 10 }),
  });
  const deleteRecording = useMutation({
    mutationFn: authApi.deleteCallRecording,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voice-call-recordings", params.id] });
      void queryClient.invalidateQueries({ queryKey: ["voice-recordings"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const setSelectedCall = useCallStore((state) => state.setSelectedCall);
  const setSessions = useCallSessionStore((state) => state.setSessions);
  const setRealtimeSessions = useRealtimeSessionStore((state) => state.setSessions);

  useEffect(() => {
    setSelectedCall(call.data ?? null);
  }, [call.data, setSelectedCall]);

  useEffect(() => {
    setSessions(sessions.data ?? []);
  }, [sessions.data, setSessions]);

  useEffect(() => {
    setRealtimeSessions(realtimeSessions.data ?? []);
  }, [realtimeSessions.data, setRealtimeSessions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Details"
        description="Inspect the inbound Twilio call and its routing assignment."
        action={
          <Button asChild variant="outline">
            <Link href="/voice/calls">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
          </Button>
        }
      />

      {call.isLoading ? (
        <SkeletonBlock className="h-80" />
      ) : call.data ? (
        <>
          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <PhoneCall className="h-5 w-5 text-zinc-500" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">{call.data.callerNumber}</h2>
                <p className="mt-1 text-sm text-zinc-500">{call.data.status}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Detail label="Call SID" value={call.data.twilioCallSid} />
              <Detail label="Caller Number" value={call.data.callerNumber} />
              <Detail label="Called Number" value={call.data.calledNumber} />
              <Detail label="Assigned Agent" value={call.data.agent.name} />
              <Detail label="Direction" value={call.data.direction} />
              <Detail label="Source" value={call.data.source} />
              <Detail label="End Reason" value={call.data.endReason} />
              <Detail label="Started" value={new Date(call.data.startedAt).toLocaleString()} />
              <Detail
                label="Answered"
                value={
                  call.data.answeredAt ? new Date(call.data.answeredAt).toLocaleString() : "Pending"
                }
              />
              <Detail
                label="Duration"
                value={call.data.durationSeconds ? `${call.data.durationSeconds}s` : "Pending"}
              />
              <Detail
                label="Phone Number"
                value={call.data.phoneNumber.friendlyName ?? call.data.phoneNumber.phoneNumber}
              />
              <Detail
                label="Conversation"
                value={call.data.conversationId ? call.data.conversationId : "Not linked yet"}
              />
              <Detail label="Created" value={new Date(call.data.createdAt).toLocaleString()} />
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-violet-500" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">AI Call Summary</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Generated asynchronously from the completed transcript.
                </p>
              </div>
            </div>
            {summary.isLoading ? <SkeletonBlock className="mt-6 h-32" /> : null}
            {!summary.isLoading && !summary.data ? (
              <p className="mt-6 text-sm text-zinc-500">
                Summary will appear after transcription and background processing complete.
              </p>
            ) : null}
            {summary.data ? (
              <div className="mt-6 space-y-5">
                <p className="max-w-4xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {summary.data.summary}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Detail label="Intent" value={summary.data.intent} />
                  <Detail label="Sentiment" value={summary.data.sentiment} />
                  <Detail label="Outcome" value={formatEventType(summary.data.outcome)} />
                  <Detail
                    label="Confidence"
                    value={`${Math.round(summary.data.confidenceScore * 100)}%`}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Next Action" value={summary.data.nextAction ?? "No action required"} />
                  <Detail
                    label="Follow-up"
                    value={summary.data.followUpRequired ? "Required" : "Not required"}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  {summary.data.model} · {summary.data.summaryVersion} ·{" "}
                  {new Date(summary.data.generatedAt).toLocaleString()}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-zinc-500" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">Call Timeline</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Chronological routing, realtime, recording, transcript, and conversation events.
                </p>
              </div>
            </div>
            <div className="mt-6">
              {timeline.isLoading ? <SkeletonBlock className="h-24" /> : null}
              {!timeline.isLoading && timeline.data?.events.length === 0 ? (
                <EmptyState
                  icon={Clock3}
                  title="No timeline events"
                  description="Call lifecycle events will appear here as processing progresses."
                />
              ) : null}
              <div className="space-y-3">
                {timeline.data?.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(event.occurredAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{formatEventType(event.type)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-zinc-500" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">OpenAI Realtime Sessions</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  AI voice connection state and bidirectional audio transport metrics.
                </p>
              </div>
            </div>

            <div className="mt-6">
              {realtimeSessions.isLoading ? <SkeletonBlock className="h-28" /> : null}
              {!realtimeSessions.isLoading && realtimeSessions.data?.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No AI voice session yet"
                  description="A realtime session appears when Twilio starts streaming an active call."
                />
              ) : null}
              <div className="space-y-3">
                {realtimeSessions.data?.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{session.agent.name}</p>
                        <p className="mt-1 break-all text-xs text-zinc-500">
                          {session.openAiSessionId ?? "OpenAI session pending"}
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-800">
                        {session.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      <Detail label="Audio In" value={String(session.audioPacketsSent)} />
                      <Detail label="Audio Out" value={String(session.audioPacketsReceived)} />
                      <Detail
                        label="Latency"
                        value={
                          session.lastLatencyMs === null ? "Pending" : `${session.lastLatencyMs}ms`
                        }
                      />
                      <Detail
                        label="Connected"
                        value={
                          session.connectedAt
                            ? new Date(session.connectedAt).toLocaleString()
                            : "Pending"
                        }
                      />
                      <Detail
                        label="Disconnected"
                        value={
                          session.disconnectedAt
                            ? new Date(session.disconnectedAt).toLocaleString()
                            : "Active"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5 text-zinc-500" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold">Media Stream Information</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Realtime Twilio Media Stream sessions for this call.
                </p>
              </div>
            </div>

            <div className="mt-6">
              {sessions.isLoading ? <SkeletonBlock className="h-24" /> : null}
              {!sessions.isLoading && sessions.data?.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  title="No media streams yet"
                  description="Twilio stream sessions will appear here after the webhook connects."
                />
              ) : null}
              <div className="space-y-3">
                {sessions.data?.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="break-all text-sm font-medium">
                        {session.streamSid ?? "Connecting"}
                      </p>
                      <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-800">
                        {session.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Detail label="Packet Count" value={String(session.packetCount)} />
                      <Detail
                        label="Connected"
                        value={
                          session.connectedAt
                            ? new Date(session.connectedAt).toLocaleString()
                            : "Pending"
                        }
                      />
                      <Detail
                        label="Disconnected"
                        value={
                          session.disconnectedAt
                            ? new Date(session.disconnectedAt).toLocaleString()
                            : "Active"
                        }
                      />
                      <Detail label="Duration" value={formatDuration(session)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <RecordingPanel
              loading={recordings.isLoading}
              recordings={recordings.data?.data ?? []}
              onDelete={(recordingId) => deleteRecording.mutate(recordingId)}
              deleting={deleteRecording.isPending}
            />
            <TranscriptPanel loading={transcript.isLoading} transcript={transcript.data ?? null} />
          </section>

          <ActionsPanel
            loading={toolExecutions.isLoading}
            executions={toolExecutions.data?.data ?? []}
          />

          <AppointmentsPanel
            loading={appointments.isLoading}
            appointments={appointments.data?.data ?? []}
          />
        </>
      ) : (
        <EmptyState
          icon={PhoneCall}
          title="Call not found"
          description="This call may belong to another workspace or no longer be available."
        />
      )}
    </div>
  );
}

function AppointmentsPanel({
  loading,
  appointments,
}: {
  loading: boolean;
  appointments: Array<Awaited<ReturnType<typeof authApi.appointments>>["data"][number]>;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-zinc-500" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Appointments Created</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Bookings linked to this call through the AI action framework.
          </p>
        </div>
      </div>
      <div className="mt-5">
        {loading ? <SkeletonBlock className="h-24" /> : null}
        {!loading && appointments.length === 0 ? (
          <p className="text-sm text-zinc-500">No appointments were created from this call.</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{appointment.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(appointment.startTime).toLocaleString()} · {appointment.timezone}
                  </p>
                </div>
                <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-800">
                  {appointment.status}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Detail label="Confirmation" value={appointment.confirmationNumber} />
                <Detail label="Source" value={appointment.source} />
                <Detail label="Contact" value={appointment.contact?.name ?? "Not linked"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionsPanel({
  loading,
  executions,
}: {
  loading: boolean;
  executions: Array<Awaited<ReturnType<typeof authApi.toolExecutions>>["data"][number]>;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <Wrench className="h-5 w-5 text-zinc-500" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Actions Executed</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Tool calls requested by the AI agent during this call.
          </p>
        </div>
      </div>
      <div className="mt-5">
        {loading ? <SkeletonBlock className="h-24" /> : null}
        {!loading && executions.length === 0 ? (
          <p className="text-sm text-zinc-500">No business actions were executed for this call.</p>
        ) : null}
        <div className="space-y-3">
          {executions.map((execution) => (
            <div
              key={execution.id}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{execution.toolName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(execution.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-800">
                  {execution.status}
                </span>
              </div>
              {execution.error ? (
                <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">
                  {execution.error}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecordingPanel({
  loading,
  recordings,
  onDelete,
  deleting,
}: {
  loading: boolean;
  recordings: Array<{
    id: string;
    fileName: string;
    status: string;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
    recordingCompletedAt: string | null;
    createdAt: string;
  }>;
  onDelete: (recordingId: string) => void;
  deleting: boolean;
}) {
  const download = useMutation({
    mutationFn: authApi.callRecordingDownload,
    onSuccess: (access) => {
      window.open(access.url, "_blank", "noopener,noreferrer");
    },
  });

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <FileAudio className="h-5 w-5 text-zinc-500" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold">Recording</h2>
          <p className="mt-1 text-sm text-zinc-500">Asynchronous playback and storage status.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? <SkeletonBlock className="h-24" /> : null}
        {!loading && recordings.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No recording has been finalized for this call yet.
          </p>
        ) : null}
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{recording.fileName}</p>
                <p className="mt-1 text-xs text-zinc-500">{recording.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <PlaybackButton
                  recordingId={recording.id}
                  disabled={recording.status !== "AVAILABLE"}
                />
                <Button
                  variant="outline"
                  size="icon"
                  disabled={recording.status !== "AVAILABLE" || download.isPending}
                  onClick={() => download.mutate(recording.id)}
                  aria-label="Download recording"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={deleting || recording.status === "DELETED"}
                  onClick={() => {
                    if (window.confirm("Delete this recording?")) {
                      onDelete(recording.id);
                    }
                  }}
                  aria-label="Delete recording"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <Detail label="Duration" value={formatRecordingDuration(recording.durationSeconds)} />
              <Detail label="Size" value={formatBytes(recording.fileSizeBytes)} />
              <Detail
                label="Completed"
                value={
                  recording.recordingCompletedAt
                    ? new Date(recording.recordingCompletedAt).toLocaleString()
                    : "Processing"
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybackButton({ recordingId, disabled }: { recordingId: string; disabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const access = useMutation({
    mutationFn: authApi.callRecordingDownload,
    onSuccess: (result) => setUrl(result.url),
  });

  if (url) {
    return <audio controls src={url} className="h-9 w-44" />;
  }

  return (
    <Button
      variant="outline"
      disabled={disabled || access.isPending}
      onClick={() => access.mutate(recordingId)}
    >
      Play
    </Button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium">{value}</p>
    </div>
  );
}

function formatEventType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDuration(session: { connectedAt: string | null; disconnectedAt: string | null }) {
  if (!session.connectedAt) {
    return "Pending";
  }

  const end = session.disconnectedAt ? new Date(session.disconnectedAt) : new Date();
  const started = new Date(session.connectedAt);
  return `${Math.max(0, Math.round((end.getTime() - started.getTime()) / 1000))}s`;
}

function formatRecordingDuration(value: number | null) {
  return value === null ? "Pending" : `${value}s`;
}

function formatBytes(value: number | null) {
  if (value === null) {
    return "Pending";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function TranscriptPanel({
  loading,
  transcript,
}: {
  loading: boolean;
  transcript: Awaited<ReturnType<typeof authApi.callTranscriptByCall>> | null;
}) {
  if (loading) {
    return <SkeletonBlock className="h-48 md:col-span-2" />;
  }

  return (
    <div className="rounded-md border border-zinc-200 p-6 dark:border-zinc-800 md:col-span-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <FileText className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold">Transcript and Summary</h2>
        </div>
        {transcript ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/voice/transcripts/${transcript.id}`}>View transcript</Link>
          </Button>
        ) : null}
      </div>
      {transcript ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>{transcript.status}</span>
            <span>{transcript.wordCount.toLocaleString()} words</span>
            <span>{transcript.segmentCount} segments</span>
          </div>
          <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {transcript.summary ??
              (transcript.status === "FAILED"
                ? transcript.failureReason
                : "Transcription is processing in the background.")}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          A transcript will appear automatically after the recording is uploaded.
        </p>
      )}
    </div>
  );
}
