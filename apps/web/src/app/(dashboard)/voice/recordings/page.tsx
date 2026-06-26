"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordingStatus } from "@ai-agent-platform/types";
import { Download, FileAudio, Pause, Play, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useRecordingStore } from "@/store/recording-store";

const statuses: Array<RecordingStatus | "ALL"> = [
  "ALL",
  "RECORDING",
  "PROCESSING",
  "AVAILABLE",
  "FAILED",
  "DELETED",
];

export default function RecordingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RecordingStatus | "ALL">("ALL");
  const playback = useRecordingPlayback();
  const recordings = useQuery({
    queryKey: ["voice-recordings", { search, status }],
    queryFn: () =>
      authApi.callRecordings({
        page: 1,
        limit: 20,
        search,
        status: status === "ALL" ? undefined : status,
      }),
    refetchInterval: (query) =>
      query.state.data?.data.some((recording) =>
        ["RECORDING", "PROCESSING", "PENDING"].includes(recording.status),
      )
        ? 3000
        : false,
  });
  const removeRecording = useMutation({
    mutationFn: authApi.deleteCallRecording,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voice-recordings"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const setRecordings = useRecordingStore((state) => state.setRecordings);
  const setLoading = useRecordingStore((state) => state.setLoading);

  useEffect(() => {
    setRecordings(recordings.data ?? null);
    setLoading(recordings.isLoading);
  }, [recordings.data, recordings.isLoading, setRecordings, setLoading]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recordings"
        description="Review tenant-scoped voice recordings captured asynchronously from Twilio streams."
      />

      <section className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search calls, agents, or filenames"
              className="h-9 w-full rounded-md border border-zinc-200 bg-transparent pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as RecordingStatus | "ALL")}
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
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recordings.isLoading ? <RowsSkeleton /> : null}
              {recordings.data?.data.map((recording) => (
                <tr
                  key={recording.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-4">
                    <Link href={`/voice/calls/${recording.callId}`} className="font-medium">
                      {recording.call?.callerNumber ?? recording.twilioCallSid}
                    </Link>
                    <div className="mt-1 text-xs text-zinc-500">
                      {recording.call?.calledNumber ?? recording.fileName}
                    </div>
                  </td>
                  <td className="px-4 py-4">{recording.call?.agent.name ?? "Unknown"}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={recording.status} />
                  </td>
                  <td className="px-4 py-4">{formatDuration(recording.durationSeconds)}</td>
                  <td className="px-4 py-4">{formatBytes(recording.fileSizeBytes)}</td>
                  <td className="px-4 py-4">{new Date(recording.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <PlaybackButton
                        recordingId={recording.id}
                        disabled={recording.status !== "AVAILABLE"}
                        isActive={playback.activeRecordingId === recording.id}
                        isPlaying={
                          playback.activeRecordingId === recording.id && playback.isPlaying
                        }
                        isLoading={playback.loadingRecordingId === recording.id}
                        onToggle={() => void playback.toggle(recording.id)}
                      />
                      <DownloadButton
                        recordingId={recording.id}
                        disabled={recording.status !== "AVAILABLE"}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={removeRecording.isPending || recording.status === "DELETED"}
                        onClick={() => {
                          if (window.confirm("Delete this recording?")) {
                            playback.stop(recording.id);
                            removeRecording.mutate(recording.id);
                          }
                        }}
                        aria-label="Delete recording"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!recordings.isLoading && recordings.data?.data.length === 0 ? (
        <EmptyState
          icon={FileAudio}
          title="No recordings yet"
          description="Recordings appear after a Twilio media stream ends and background upload completes."
        />
      ) : null}
    </div>
  );
}

function PlaybackButton({
  recordingId,
  disabled,
  isActive,
  isPlaying,
  isLoading,
  onToggle,
}: {
  recordingId: string;
  disabled: boolean;
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  const label = isLoading ? "Loading recording" : isPlaying ? "Pause recording" : "Play recording";

  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="icon"
      disabled={disabled || isLoading}
      onClick={onToggle}
      aria-label={`${label} ${recordingId}`}
      title={label}
    >
      {isPlaying ? (
        <Pause className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Play className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function useRecordingPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestVersionRef = useRef(0);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [loadingRecordingId, setLoadingRecordingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audioRef.current = null;
    };
  }, []);

  async function toggle(recordingId: string) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (activeRecordingId === recordingId && audio.src) {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
      return;
    }

    audio.pause();
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setLoadingRecordingId(recordingId);
    try {
      const access = await authApi.callRecordingDownload(recordingId);
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      audio.src = access.url;
      setActiveRecordingId(recordingId);
      await audio.play();
    } catch {
      if (requestVersionRef.current === requestVersion) {
        audio.removeAttribute("src");
        setActiveRecordingId(null);
        setIsPlaying(false);
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoadingRecordingId(null);
      }
    }
  }

  function stop(recordingId: string) {
    if (activeRecordingId !== recordingId && loadingRecordingId !== recordingId) {
      return;
    }
    requestVersionRef.current += 1;
    const audio = audioRef.current;
    audio?.pause();
    audio?.removeAttribute("src");
    audio?.load();
    setActiveRecordingId(null);
    setLoadingRecordingId(null);
    setIsPlaying(false);
  }

  return {
    activeRecordingId,
    loadingRecordingId,
    isPlaying,
    toggle,
    stop,
  };
}

function DownloadButton({ recordingId, disabled }: { recordingId: string; disabled: boolean }) {
  const download = useMutation({
    mutationFn: authApi.callRecordingDownload,
    onSuccess: (access) => {
      window.open(access.url, "_blank", "noopener,noreferrer");
    },
  });

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={disabled || download.isPending}
      onClick={() => download.mutate(recordingId)}
      aria-label="Download recording"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function RowsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <tr key={row}>
          <td className="px-4 py-4" colSpan={7}>
            <SkeletonBlock className="h-10" />
          </td>
        </tr>
      ))}
    </>
  );
}

function StatusBadge({ status }: { status: RecordingStatus }) {
  return (
    <span className="rounded-full border border-zinc-200 px-2 py-1 text-xs font-medium dark:border-zinc-800">
      {status}
    </span>
  );
}

function formatDuration(value: number | null) {
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
