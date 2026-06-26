"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock } from "lucide-react";
import type React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const inputClassName =
  "h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-800 dark:bg-zinc-950";

const availabilitySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().min(1).max(80),
    bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
    bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  })
  .refine((value) => value.startTime < value.endTime, {
    path: ["endTime"],
    message: "End time must be after start time.",
  });

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ["availability"], queryFn: () => authApi.availability() });
  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    },
  });
  const createRule = useMutation({
    mutationFn: (values: AvailabilityFormValues) =>
      authApi.createAvailability({ ...values, isEnabled: true }),
    onSuccess: () => {
      form.reset(form.getValues());
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
  });
  const toggleRule = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      authApi.updateAvailability(id, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["availability"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Define weekly booking windows used by AI agents before confirming appointments."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Weekly schedule</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Rules are evaluated dynamically for the requested date. Slots are not pre-generated.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Day</th>
                  <th className="px-6 py-3 font-medium">Window</th>
                  <th className="px-6 py-3 font-medium">Timezone</th>
                  <th className="px-6 py-3 font-medium">Buffers</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rules.isLoading ? <RowsSkeleton /> : null}
                {rules.data?.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-6 py-4 font-medium">{weekdays[rule.dayOfWeek]}</td>
                    <td className="px-6 py-4">
                      {rule.startTime} - {rule.endTime}
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{rule.timezone}</td>
                    <td className="px-6 py-4 text-zinc-500">
                      {rule.bufferBeforeMinutes}m before / {rule.bufferAfterMinutes}m after
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          rule.isEnabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900",
                        )}
                      >
                        {rule.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleRule.isPending}
                        onClick={() =>
                          toggleRule.mutate({ id: rule.id, isEnabled: !rule.isEnabled })
                        }
                      >
                        {rule.isEnabled ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rules.isLoading && rules.data?.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CalendarDays}
                title="No availability configured"
                description="Add weekly windows before agents can confirm appointment bookings."
              />
            </div>
          ) : null}
        </div>

        <form
          className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={form.handleSubmit((values) => createRule.mutate(values))}
        >
          <div>
            <h2 className="text-sm font-semibold">Add weekly window</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Add multiple windows per day to model lunch breaks.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Day</span>
              <select className={cn(inputClassName, "w-full")} {...form.register("dayOfWeek")}>
                {weekdays.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start" type="time" {...form.register("startTime")} />
              <Input label="End" type="time" {...form.register("endTime")} />
            </div>
            <Input label="Timezone" {...form.register("timezone")} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Buffer before"
                type="number"
                {...form.register("bufferBeforeMinutes")}
              />
              <Input
                label="Buffer after"
                type="number"
                {...form.register("bufferAfterMinutes")}
              />
            </div>
            {Object.values(form.formState.errors)[0]?.message ? (
              <p className="text-sm text-red-600">
                {String(Object.values(form.formState.errors)[0]?.message)}
              </p>
            ) : null}
            {createRule.error ? (
              <p className="text-sm text-red-600">{createRule.error.message}</p>
            ) : null}
            <Button className="w-full" disabled={createRule.isPending}>
              <Clock className="h-4 w-4" aria-hidden="true" />
              {createRule.isPending ? "Saving..." : "Add availability"}
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
      <td className="px-6 py-4" colSpan={6}>
        <SkeletonBlock className="h-9" />
      </td>
    </tr>
  ));
}
