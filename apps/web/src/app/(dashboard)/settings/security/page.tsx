"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { PageHeader } from "@/components/layout/page-header";
import { authApi } from "@/lib/auth-api";

const securitySchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(100, "Password must be at most 100 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

type SecurityForm = z.infer<typeof securitySchema>;

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<SecurityForm>({
    resolver: zodResolver(securitySchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function handleSubmit() {
    setNotice("Password change is ready for the account security API.");
    form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  async function handleLogout() {
    await authApi.logout();
    router.replace("/login");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security"
        description="Review session status and prepare account security controls."
      />

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form
          className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
            <h2 className="text-base font-semibold">Password settings</h2>
          </div>
          <div className="mt-6 grid gap-4">
            <PasswordField
              label="Current Password"
              error={form.formState.errors.currentPassword?.message}
              inputProps={form.register("currentPassword")}
            />
            <PasswordField
              label="New Password"
              error={form.formState.errors.newPassword?.message}
              inputProps={form.register("newPassword")}
            />
            <PasswordField
              label="Confirm Password"
              error={form.formState.errors.confirmPassword?.message}
              inputProps={form.register("confirmPassword")}
            />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="submit">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Change Password
            </Button>
            <Button variant="outline" type="button" disabled>
              Logout All Devices
            </Button>
          </div>
        </form>

        <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-base font-semibold">Security information</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Detail label="Active Session" value="This browser session" />
            <Detail label="Last Login" value="Current session" />
            <Detail
              label="Session Storage"
              value="Access and refresh token managed by auth store"
            />
          </dl>
          <Button className="mt-6 w-full" variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </section>
    </div>
  );
}

function PasswordField({
  label,
  error,
  inputProps,
}: {
  label: string;
  error?: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-teal-600 dark:border-zinc-800 dark:bg-zinc-950"
        type="password"
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
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
