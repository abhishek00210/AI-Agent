import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  Clock,
  PhoneCall,
  Plus,
  Upload,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

const metrics = [
  { label: "Total Agents", value: "0", detail: "Ready to create", icon: Bot },
  { label: "Total Calls", value: "0", detail: "No calls yet", icon: PhoneCall },
  { label: "Total Leads", value: "0", detail: "Lead capture pending", icon: UsersRound },
  { label: "Total Appointments", value: "0", detail: "No bookings yet", icon: CalendarDays },
];

const quickActions = [
  { label: "Create Agent", href: "/agents/create", icon: Plus },
  { label: "Upload Knowledge", href: "/knowledge/documents", icon: Upload },
  { label: "Connect Number", href: "/voice/phone-numbers", icon: PhoneCall },
  { label: "View Analytics", href: "/analytics", icon: BarChart3 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your tenant workspace overview for agents, voice operations, leads, and appointments."
        action={
          <Button asChild>
            <Link href="/agents/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Agent
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-normal">{metric.value}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{metric.detail}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold">Recent activity</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Important workspace events will appear here as modules come online.
            </p>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[
              "Workspace created",
              "Authentication enabled",
              "Tenant isolation configured",
              "Voice provider boundaries ready",
            ].map((item) => (
              <div key={item} className="flex items-center gap-4 px-6 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Foundation event · local environment
                  </p>
                </div>
                <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Ready</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Quick actions</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Start the most common workflows from one place.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.label} variant="outline" className="justify-start" asChild>
                  <Link href={action.href}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <EmptyState
        icon={BookOpen}
        title="No agents are live yet"
        description="Create your first voice agent, add knowledge, and connect a phone number to start handling customer conversations from this workspace."
        action={
          <Button asChild>
            <Link href="/agents/create">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Agent
            </Link>
          </Button>
        }
      />
    </div>
  );
}
