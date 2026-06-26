"use client";

import type { AgentSummary, AppointmentStatus } from "@ai-agent-platform/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Search, XCircle } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";
import { useAppointmentStore } from "@/store/appointment-store";

const statuses: Array<"ALL" | AppointmentStatus> = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const bookingSchema = z.object({
  agentId: z.string().uuid("Select an agent."),
  title: z.string().min(1).max(160),
  preferredDate: z.string().min(10),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  notes: z.string().max(2000).optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const inputClassName =
  "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-800 dark:bg-zinc-950";

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const { search, status, setAppointments, setLoading, setSearch, setStatus } =
    useAppointmentStore();
  const query = {
    search: search || undefined,
    status: status === "ALL" ? undefined : status,
    limit: 50,
  };
  const appointments = useQuery({
    queryKey: ["appointments", query],
    queryFn: () => authApi.appointments(query),
  });
  const agents = useQuery({
    queryKey: ["agents-for-appointments"],
    queryFn: () => authApi.agents({ status: "ACTIVE", limit: 100 }),
  });
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      agentId: "",
      title: "",
      preferredDate: new Date().toISOString().slice(0, 10),
      preferredTime: "09:00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      durationMinutes: 30,
      notes: "",
    },
  });
  const createAppointment = useMutation({
    mutationFn: (values: BookingFormValues) =>
      authApi.createAppointment({ ...values, source: "MANUAL" }),
    onSuccess: () => {
      form.reset({ ...form.getValues(), title: "", notes: "" });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  const cancelAppointment = useMutation({
    mutationFn: (appointmentId: string) => authApi.cancelAppointment(appointmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  useEffect(() => {
    setAppointments(appointments.data ?? null);
    setLoading(appointments.isLoading);
  }, [appointments.data, appointments.isLoading, setAppointments, setLoading]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Manage confirmed AI-assisted bookings from voice, chat, widgets, and manual scheduling."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                className={cn(inputClassName, "w-full pl-9")}
                placeholder="Search title, confirmation, or notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              className={cn(inputClassName, "md:w-48")}
              value={status}
              onChange={(event) => setStatus(event.target.value as "ALL" | AppointmentStatus)}
            >
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All statuses" : formatStatus(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Appointment</th>
                  <th className="px-6 py-3 font-medium">Agent</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium">Confirmation</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {appointments.isLoading ? <RowsSkeleton /> : null}
                {appointments.data?.data.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{appointment.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {appointment.contact?.name ?? "No contact linked"}
                      </div>
                    </td>
                    <td className="px-6 py-4">{appointment.agent?.name ?? "Unknown"}</td>
                    <td className="px-6 py-4">
                      <div>{new Date(appointment.startTime).toLocaleString()}</div>
                      <div className="mt-1 text-xs text-zinc-500">{appointment.timezone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={appointment.status} />
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{formatStatus(appointment.source)}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {appointment.confirmationNumber}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          cancelAppointment.isPending || appointment.status === "CANCELLED"
                        }
                        onClick={() => cancelAppointment.mutate(appointment.id)}
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!appointments.isLoading && appointments.data?.data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CalendarCheck}
                title="No appointments yet"
                description="Bookings created by AI agents and manual schedulers will appear here."
              />
            </div>
          ) : null}
        </div>

        <form
          className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={form.handleSubmit((values) => createAppointment.mutate(values))}
        >
          <div>
            <h2 className="text-sm font-semibold">Create appointment</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Local scheduling validates availability and conflicts before confirming.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Agent</span>
              <select className={cn(inputClassName, "w-full")} {...form.register("agentId")}>
                <option value="">Select active agent</option>
                {agents.data?.data.map((agent: AgentSummary) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Title" {...form.register("title")} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" {...form.register("preferredDate")} />
              <Input label="Time" type="time" {...form.register("preferredTime")} />
            </div>
            <Input label="Timezone" {...form.register("timezone")} />
            <Input
              label="Duration minutes"
              type="number"
              {...form.register("durationMinutes")}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Notes</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-800 dark:bg-zinc-950"
                {...form.register("notes")}
              />
            </label>
            {Object.values(form.formState.errors)[0]?.message ? (
              <p className="text-sm text-red-600">
                {String(Object.values(form.formState.errors)[0]?.message)}
              </p>
            ) : null}
            {createAppointment.error ? (
              <p className="text-sm text-red-600">{createAppointment.error.message}</p>
            ) : null}
            <Button className="w-full" disabled={createAppointment.isPending}>
              {createAppointment.isPending ? "Booking..." : "Book appointment"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-500">{label}</span>
      <input className={cn(inputClassName, "w-full", className)} {...props} />
    </label>
  );
}

function RowsSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <tr key={index}>
      <td className="px-6 py-4" colSpan={7}>
        <SkeletonBlock className="h-9" />
      </td>
    </tr>
  ));
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        status === "CONFIRMED" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950",
        status === "PENDING" && "bg-amber-100 text-amber-700 dark:bg-amber-950",
        status === "CANCELLED" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-900",
        status === "COMPLETED" && "bg-sky-100 text-sky-700 dark:bg-sky-950",
        status === "NO_SHOW" && "bg-red-100 text-red-700 dark:bg-red-950",
      )}
    >
      {formatStatus(status)}
    </span>
  );
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
