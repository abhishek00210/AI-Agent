"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@ai-agent-platform/ui";
import { AuthLink, AuthPanel, Notice, TextField } from "@/components/auth/auth-panel";
import { authApi } from "@/lib/auth-api";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email."),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordForm) {
    setError(null);
    setSuccess(false);

    try {
      await authApi.forgotPassword(values);
      setSuccess(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to send reset email.",
      );
    }
  }

  return (
    <AuthPanel
      title="Reset password"
      description="Enter your email and we will send a reset link if the account exists."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? (
          <Notice tone="success">Check your email for a password reset link.</Notice>
        ) : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register("email")}
        />
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthPanel>
  );
}
