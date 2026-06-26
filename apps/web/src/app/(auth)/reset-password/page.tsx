"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { AuthLink, AuthPanel, Notice, TextField } from "@/components/auth/auth-panel";
import { authApi } from "@/lib/auth-api";

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters.").max(100),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading reset form...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(token ? null : "Reset token is missing.");
  const [success, setSuccess] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);
    setSuccess(false);

    try {
      await authApi.resetPassword({ token, newPassword: values.newPassword });
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 1200);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reset password.");
    }
  }

  return (
    <AuthPanel
      title="Set new password"
      description="Choose a new password for your account."
      footer={
        <>
          Back to <AuthLink href="/login">sign in</AuthLink>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">Password updated. Redirecting to sign in.</Notice> : null}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          disabled={!token || success}
          error={form.formState.errors.newPassword?.message}
          {...form.register("newPassword")}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          disabled={!token || success}
          error={form.formState.errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
        <Button
          className="w-full"
          type="submit"
          disabled={!token || form.formState.isSubmitting || success}
        >
          {form.formState.isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>
    </AuthPanel>
  );
}
