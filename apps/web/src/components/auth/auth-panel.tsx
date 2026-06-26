import type React from "react";
import Link from "next/link";

export function AuthPanel({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.065] p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
      <div className="mb-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Zodo AI Platform
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 text-sm text-slate-400">{footer}</div> : null}
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="font-semibold text-emerald-200 transition hover:text-emerald-100" href={href}>
      {children}
    </Link>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs text-red-300">{message}</p> : null;
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          : "rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
      }
    >
      {children}
    </div>
  );
}

export function TextField(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
  },
) {
  const { label, error, ...inputProps } = props;

  return (
    <label className="block text-sm font-medium text-slate-200">
      {label}
      <input
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
        {...inputProps}
      />
      <FieldError message={error} />
    </label>
  );
}
