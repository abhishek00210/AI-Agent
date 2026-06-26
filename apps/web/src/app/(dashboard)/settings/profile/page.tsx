"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Save, UserRound } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar, AvatarFallback, Button } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/store/auth-store";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfileSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState<string | null>(null);
  const initials = `${user?.firstName?.[0] ?? "A"}${user?.lastName?.[0] ?? "P"}`.toUpperCase();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
    },
  });

  function handleSubmit() {
    setNotice("Profile changes are ready for the account update API.");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="Manage personal information for your authenticated workspace account."
      />

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Profile avatar</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Avatar upload support can connect here when storage is implemented.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <Button variant="outline" disabled>
              <Camera className="h-4 w-4" aria-hidden="true" />
              Upload avatar
            </Button>
          </div>
        </div>

        <form
          className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
            <h2 className="text-base font-semibold">Personal information</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="First Name"
              error={form.formState.errors.firstName?.message}
              inputProps={form.register("firstName")}
            />
            <Field
              label="Last Name"
              error={form.formState.errors.lastName?.message}
              inputProps={form.register("lastName")}
            />
            <Field
              label="Email"
              type="email"
              error={form.formState.errors.email?.message}
              inputProps={form.register("email")}
              className="sm:col-span-2"
            />
          </div>
          <div className="mt-6">
            <Button type="submit">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Changes
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold">Account information</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <Detail label="User ID" value={user?.id ?? "Unavailable"} />
          <Detail label="Account Created" value="Available after profile API expansion" />
          <Detail label="Last Login" value="Current session" />
        </dl>
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  inputProps,
  type = "text",
  className,
}: {
  label: string;
  error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium ${className ?? ""}`}>
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
        type={type}
        {...inputProps}
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
