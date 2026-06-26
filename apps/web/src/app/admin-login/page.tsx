"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminApi.login({ email, password });
      router.replace(params.get("next") || "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-zinc-950 px-5 text-zinc-100">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/50"
      >
        <div className="mb-8">
          <p className="text-sm font-medium text-teal-300">Zodo Super Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Separate control-plane authentication for global platform operations.
          </p>
        </div>
        <label className="block text-sm text-zinc-400">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-zinc-100 outline-none focus:border-teal-400"
            autoComplete="email"
            required
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-400">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-zinc-100 outline-none focus:border-teal-400"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        ) : null}
        <button
          disabled={loading}
          className="mt-6 h-11 w-full rounded-xl bg-teal-300 font-semibold text-zinc-950 transition hover:bg-teal-200 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
