"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  CheckCircle2,
  FileAudio,
  FileText,
  Gauge,
  PhoneCall,
  RefreshCcw,
  Settings2,
  Signal,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

export default function VoicePage() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["voice-dashboard"],
    queryFn: authApi.voiceDashboard,
  });
  const twilio = useQuery({
    queryKey: ["twilio-status"],
    queryFn: authApi.twilioStatus,
  });
  const verifyTwilio = useMutation({
    mutationFn: authApi.verifyTwilio,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["twilio-status"] });
    },
  });
  const syncNumbers = useMutation({
    mutationFn: authApi.syncPhoneNumbers,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
    },
  });

  const stats = dashboard.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice"
        description="Configure Twilio numbers and prepare tenant-scoped routing for AI voice agents."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={verifyTwilio.isPending}
              onClick={() => verifyTwilio.mutate()}
            >
              <Signal className="h-4 w-4" aria-hidden="true" />
              Verify Twilio
            </Button>
            <Button disabled={syncNumbers.isPending} onClick={() => syncNumbers.mutate()}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Sync Numbers
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Numbers"
          value={stats?.totalNumbers}
          loading={dashboard.isLoading}
        />
        <MetricCard label="Assigned" value={stats?.assignedNumbers} loading={dashboard.isLoading} />
        <MetricCard
          label="Unassigned"
          value={stats?.unassignedNumbers}
          loading={dashboard.isLoading}
        />
        <MetricCard label="Active" value={stats?.activeNumbers} loading={dashboard.isLoading} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RealtimeMetric
          label="Total Calls"
          value={stats?.totalCalls}
          loading={dashboard.isLoading}
          icon={PhoneCall}
        />
        <RealtimeMetric
          label="Completed Calls"
          value={stats?.completedCalls}
          loading={dashboard.isLoading}
          icon={CheckCircle2}
        />
        <RealtimeMetric
          label="Missed Calls"
          value={stats?.missedCalls}
          loading={dashboard.isLoading}
          icon={XCircle}
        />
        <RealtimeMetric
          label="Average Duration"
          value={`${stats?.averageDurationSeconds ?? 0}s`}
          loading={dashboard.isLoading}
          icon={Gauge}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RealtimeMetric
          label="Recording Rate"
          value={`${stats?.recordingRate ?? 0}%`}
          loading={dashboard.isLoading}
          icon={FileAudio}
        />
        <RealtimeMetric
          label="Transcription Rate"
          value={`${stats?.transcriptionRate ?? 0}%`}
          loading={dashboard.isLoading}
          icon={FileText}
        />
        <RealtimeMetric
          label="Average Response"
          value={`${stats?.averageResponseTimeMs ?? 0}ms`}
          loading={dashboard.isLoading}
          icon={Signal}
        />
        <RealtimeMetric
          label="Today's Calls"
          value={stats?.todayCalls}
          loading={dashboard.isLoading}
          icon={PhoneCall}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RealtimeMetric
          label="Transcripts"
          value={stats?.totalTranscripts}
          loading={dashboard.isLoading}
          icon={FileText}
        />
        <RealtimeMetric
          label="Completed"
          value={stats?.completedTranscripts}
          loading={dashboard.isLoading}
          icon={CheckCircle2}
        />
        <RealtimeMetric
          label="Processing"
          value={stats?.processingTranscripts}
          loading={dashboard.isLoading}
          icon={RefreshCcw}
        />
        <RealtimeMetric
          label="Average Confidence"
          value={
            stats?.averageTranscriptConfidence == null
              ? "Unavailable"
              : `${Math.round(stats.averageTranscriptConfidence * 100)}%`
          }
          loading={dashboard.isLoading}
          icon={Gauge}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RealtimeMetric
          label="Recordings"
          value={stats?.totalRecordings}
          loading={dashboard.isLoading}
          icon={FileAudio}
        />
        <RealtimeMetric
          label="Available"
          value={stats?.availableRecordings}
          loading={dashboard.isLoading}
          icon={CheckCircle2}
        />
        <RealtimeMetric
          label="Recording Failed"
          value={stats?.failedRecordings}
          loading={dashboard.isLoading}
          icon={XCircle}
        />
        <RealtimeMetric
          label="Storage Used"
          value={formatBytes(stats?.recordingStorageBytes ?? 0)}
          loading={dashboard.isLoading}
          icon={FileAudio}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StreamMetric
          label="Total Streams"
          value={stats?.totalStreams}
          loading={dashboard.isLoading}
        />
        <StreamMetric
          label="Connected"
          value={stats?.connectedStreams}
          loading={dashboard.isLoading}
        />
        <StreamMetric
          label="Disconnected"
          value={stats?.disconnectedStreams}
          loading={dashboard.isLoading}
        />
        <StreamMetric label="Failed" value={stats?.failedStreams} loading={dashboard.isLoading} />
        <StreamMetric
          label="Packets"
          value={stats?.packetsProcessed}
          loading={dashboard.isLoading}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RealtimeMetric
          label="Realtime Sessions"
          value={stats?.realtimeSessions}
          loading={dashboard.isLoading}
          icon={AudioLines}
        />
        <RealtimeMetric
          label="Connected Calls"
          value={stats?.activeRealtimeSessions}
          loading={dashboard.isLoading}
          icon={Signal}
        />
        <RealtimeMetric
          label="Connection Success"
          value={`${stats?.realtimeConnectionSuccessRate ?? 0}%`}
          loading={dashboard.isLoading}
          icon={CheckCircle2}
        />
        <RealtimeMetric
          label="Average Latency"
          value={`${stats?.averageRealtimeLatencyMs ?? 0}ms`}
          loading={dashboard.isLoading}
          icon={Gauge}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Phone Number Operations</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Sync Twilio inventory, assign agents, and manage number status before call routing
                is enabled.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/voice/phone-numbers">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Manage
              </Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PlaceholderMetric label="Total Calls" value={stats?.totalCalls ?? 0} />
            <PlaceholderMetric label="Today" value={stats?.todayCalls ?? 0} />
            <PlaceholderMetric label="Failed" value={stats?.failedCalls ?? 0} />
            <PlaceholderMetric label="Active Numbers" value={stats?.activeNumbers ?? 0} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DistributionPanel
              title="Status Distribution"
              items={stats?.statusDistribution ?? []}
            />
            <CallsPerDayPanel items={stats?.callsPerDay ?? []} />
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Recent Calls</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Incoming webhook records will appear here as calls route.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/voice/calls">View Calls</Link>
            </Button>
          </div>
          <div className="mt-6 space-y-3">
            {dashboard.isLoading ? <SkeletonBlock className="h-16" /> : null}
            {stats?.recentCalls.map((call) => (
              <Link
                key={call.id}
                href={`/voice/calls/${call.id}`}
                className="block rounded-md border border-zinc-200 px-4 py-3 text-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{call.callerNumber}</span>
                  <span className="text-xs text-zinc-500">{call.status}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {call.calledNumber} · {call.agent.name}
                </div>
              </Link>
            ))}
            {!dashboard.isLoading && stats?.recentCalls.length === 0 ? (
              <p className="text-sm text-zinc-500">No calls have been routed yet.</p>
            ) : null}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <PlaceholderMetric label="Duration" value={`${stats?.callDurationSeconds ?? 0}s`} />
            <PlaceholderMetric label="Bookings" value={stats?.bookings ?? 0} />
            <PlaceholderMetric label="Leads" value={stats?.leads ?? 0} />
          </div>
        </div>

        <aside className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Twilio Connection</h2>
          {twilio.isLoading ? (
            <div className="mt-5 space-y-3">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-10" />
            </div>
          ) : twilio.data?.connected ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Connected
              </div>
              <Detail label="Account SID" value={twilio.data.accountSid ?? "Not available"} />
              <Detail label="Friendly Name" value={twilio.data.friendlyName ?? "Twilio Account"} />
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                icon={XCircle}
                title="Twilio not verified"
                description="Add credentials in the API environment, then verify the connection."
              />
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function MetricCard({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{label}</p>
        <PhoneCall className="h-4 w-4 text-zinc-400" aria-hidden="true" />
      </div>
      {loading ? (
        <SkeletonBlock className="mt-4 h-8 w-20" />
      ) : (
        <p className="mt-4 text-3xl font-semibold">{value ?? 0}</p>
      )}
    </div>
  );
}

function DistributionPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ status: string; count: number }>;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-zinc-500">No call statuses yet.</p> : null}
        {items.map((item) => (
          <div key={item.status} className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">{formatLabel(item.status)}</span>
            <span className="font-medium">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallsPerDayPanel({ items }: { items: Array<{ date: string; count: number }> }) {
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-medium">Calls Per Day</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">No daily call data yet.</p>
        ) : null}
        {items.slice(-7).map((item) => (
          <div key={item.date} className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">{item.date}</span>
            <span className="font-medium">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function PlaceholderMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function StreamMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{label}</p>
        <Signal className="h-4 w-4 text-zinc-400" aria-hidden="true" />
      </div>
      {loading ? (
        <SkeletonBlock className="mt-3 h-6 w-16" />
      ) : (
        <p className="mt-3 text-2xl font-semibold">{value ?? 0}</p>
      )}
    </div>
  );
}

function RealtimeMetric({
  label,
  value,
  loading,
  icon: Icon,
}: {
  label: string;
  value?: string | number;
  loading: boolean;
  icon: typeof AudioLines;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 text-zinc-400" aria-hidden="true" />
      </div>
      {loading ? (
        <SkeletonBlock className="mt-4 h-8 w-20" />
      ) : (
        <p className="mt-4 text-2xl font-semibold">{value ?? 0}</p>
      )}
    </div>
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
