import type React from "react";
import Image from "next/image";
import Link from "next/link";

const logoSrc = "/brand/zodo-ai-logo.png";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-svh overflow-hidden bg-[#05070d] text-white lg:grid-cols-[0.92fr_1.08fr]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_12%,rgba(52,211,153,0.20),transparent_28%),radial-gradient(circle_at_82%_4%,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#05070d_0%,#070914_54%,#03040a_100%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:64px_64px]" />

      <section className="relative z-10 hidden flex-col justify-between border-r border-white/10 bg-white/[0.035] p-8 backdrop-blur-2xl lg:flex">
        <Link href="/" className="inline-flex w-fit focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <Image
            src={logoSrc}
            alt="Zodo AI"
            width={191}
            height={58}
            priority
            className="h-12 w-auto rounded-xl object-contain shadow-lg shadow-emerald-500/10"
          />
        </Link>
        <div className="max-w-xl">
          <p className="mb-5 inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-medium text-emerald-100">
            AI employees that work for you
          </p>
          <h1 className="text-balance text-6xl font-semibold tracking-[-0.07em] leading-[0.9]">
            Your business is open even when your team is not.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-300">
            Sign in or create your workspace to answer calls, qualify leads, book appointments, and follow up automatically.
          </p>
          <div className="mt-10 space-y-3">
            {[
              "Voice + chat employees for Canada and India",
              "Customer memory, summaries, timelines, and CRM",
              "Twilio, Exotel, Stripe, and Razorpay ready",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.75)]" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live workflow</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-300">
            {["Call", "Answer", "Book", "Follow up"].map((step, index) => (
              <div key={step} className="rounded-2xl bg-white/[0.055] p-3">
                <span className="mx-auto mb-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-300/15 text-emerald-100">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 flex min-h-svh items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="absolute left-5 top-5 lg:hidden">
          <Link href="/" className="inline-flex focus:outline-none focus:ring-2 focus:ring-emerald-300">
            <Image
              src={logoSrc}
              alt="Zodo AI"
              width={166}
              height={50}
              priority
              className="h-11 w-auto rounded-xl object-contain"
            />
          </Link>
        </div>
        {children}
      </section>
    </main>
  );
}
