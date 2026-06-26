"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, cn } from "@ai-agent-platform/ui";
import { AuthLink, AuthPanel, Notice, TextField } from "@/components/auth/auth-panel";
import { authApi } from "@/lib/auth-api";
import { useAuthStore } from "@/store/auth-store";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    email: z.string().email("Enter a valid email."),
    organizationName: z.string().trim().min(1, "Organization name is required."),
    industry: z.string().trim().min(1, "Industry is required."),
    companySize: z.string().optional(),
    country: z.enum(["CA", "IN"]),
    selectedPlan: z.enum(["STARTER", "PRO", "AGENCY"]),
    password: z.string().min(8, "Password must be at least 8 characters.").max(100),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      organizationName: "",
      industry: "",
      companySize: "",
      country: "CA",
      selectedPlan: "STARTER",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterForm) {
    setError(null);

    try {
      const session = await authApi.register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        organizationName: values.organizationName,
        industry: values.industry,
        companySize: values.companySize || undefined,
        country: values.country,
        password: values.password,
      });
      setSession(session);
      try {
        const checkout = await authApi.createBillingCheckout(values.selectedPlan);
        window.location.assign(checkout.checkoutUrl);
      } catch (checkoutError) {
        setError(
          checkoutError instanceof Error
            ? `${checkoutError.message} Workspace created. Add Stripe/Razorpay plan IDs, then retry from Billing.`
            : "Workspace created, but checkout is not configured yet. Retry from Billing.",
        );
        router.replace("/billing");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create account.");
    }
  }

  const country = form.watch("country");
  const selectedPlan = form.watch("selectedPlan");
  const selectedCountry = countryOptions.find((option) => option.code === country) ?? countryOptions[0];
  const selectedPlanOption =
    planOptions.find((option) => option.plan === selectedPlan) ?? planOptions[0];

  async function next(fields: Array<keyof RegisterForm>) {
    const valid = await form.trigger(fields);
    if (valid) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <AuthPanel
      title="Create your AI employee workspace"
      description="Start with your business country so telephony, payments, currency, timezone, and tax defaults are provisioned correctly."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <StepIndicator active={step} />

        {step === 0 ? (
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                autoComplete="given-name"
                error={form.formState.errors.firstName?.message}
                {...form.register("firstName")}
              />
              <TextField
                label="Last name"
                autoComplete="family-name"
                error={form.formState.errors.lastName?.message}
                {...form.register("lastName")}
              />
            </div>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.confirmPassword?.message}
              {...form.register("confirmPassword")}
            />
            <Button
              className="h-12 w-full rounded-2xl bg-white font-semibold text-slate-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-100"
              type="button"
              onClick={() =>
                void next(["firstName", "lastName", "email", "password", "confirmPassword"])
              }
            >
              Continue to organization
            </Button>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4">
            <TextField
              label="Organization name"
              autoComplete="organization"
              error={form.formState.errors.organizationName?.message}
              {...form.register("organizationName")}
            />
            <TextField
              label="Industry"
              placeholder="Roofing, dental clinic, real estate..."
              error={form.formState.errors.industry?.message}
              {...form.register("industry")}
            />
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Company size optional
              <select
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition hover:border-white/20 focus:border-emerald-300/60 focus:ring-4 focus:ring-emerald-300/10"
                {...form.register("companySize")}
              >
                <option value="">Select size</option>
                <option value="1">Just me</option>
                <option value="2-10">2–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="200+">200+</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15 text-white hover:bg-white/10" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                type="button"
                className="h-12 rounded-2xl bg-white font-semibold text-slate-950 hover:bg-emerald-100"
                onClick={() => void next(["organizationName", "industry"])}
              >
                Choose country
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {countryOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={cn(
                    "rounded-[1.35rem] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300",
                    country === option.code
                      ? "border-emerald-300/60 bg-emerald-300/10 shadow-lg shadow-emerald-950/20"
                      : "border-white/10 bg-slate-950/55 hover:border-emerald-300/30 hover:bg-white/[0.07]",
                  )}
                  onClick={() => form.setValue("country", option.code, { shouldValidate: true })}
                  aria-pressed={country === option.code}
                >
                  <div className="text-3xl" aria-hidden="true">
                    {option.flag}
                  </div>
                  <h3 className="mt-3 font-semibold text-white">{option.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{option.recommendation}</p>
                  <div className="mt-4 grid gap-1 text-xs text-slate-300">
                    <span>{option.telephony}</span>
                    <span>{option.payments}</span>
                    <span>{option.currency}</span>
                  </div>
                </button>
              ))}
            </div>
            <CountryPreview option={selectedCountry} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15 text-white hover:bg-white/10" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" className="h-12 rounded-2xl bg-white font-semibold text-slate-950 hover:bg-emerald-100" onClick={() => setStep(3)}>
                Choose plan
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-3">
              {planOptions.map((option) => (
                <button
                  key={option.plan}
                  type="button"
                  className={cn(
                    "rounded-[1.35rem] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300",
                    selectedPlan === option.plan
                      ? "border-emerald-300/60 bg-emerald-300/10 shadow-lg shadow-emerald-950/20"
                      : "border-white/10 bg-slate-950/55 hover:border-emerald-300/30 hover:bg-white/[0.07]",
                  )}
                  onClick={() =>
                    form.setValue("selectedPlan", option.plan, { shouldValidate: true })
                  }
                  aria-pressed={selectedPlan === option.plan}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">{option.name}</h3>
                    {option.recommended ? (
                      <span className="rounded-full bg-emerald-300 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-950">
                        Best
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    {option.price}
                    <span className="text-xs font-normal text-slate-500">/mo</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{option.currencyNote}</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-300">
                    {option.features.map((feature) => (
                      <li key={feature}>✓ {feature}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <div className="rounded-[1.35rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              After account creation, payment opens through Stripe for Canada or Razorpay for India.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15 text-white hover:bg-white/10" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" className="h-12 rounded-2xl bg-white font-semibold text-slate-950 hover:bg-emerald-100" onClick={() => setStep(4)}>
                Review setup
              </Button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-5">
            <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/55 p-4 text-sm">
              <h3 className="font-semibold text-white">Ready to provision</h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Summary label="Organization" value={form.getValues("organizationName")} />
                <Summary label="Industry" value={form.getValues("industry")} />
                <Summary label="Country" value={`${selectedCountry.flag} ${selectedCountry.name}`} />
                <Summary label="Telephony" value={selectedCountry.telephony} />
                <Summary label="Payments" value={selectedCountry.payments} />
                <Summary label="Currency" value={selectedCountry.currency} />
                <Summary
                  label="Selected plan"
                  value={`${selectedPlanOption.name} ${selectedPlanOption.price}/mo`}
                />
              </dl>
            </div>
            <CountryPreview option={selectedCountry} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15 text-white hover:bg-white/10" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button type="submit" className="h-12 rounded-2xl bg-white font-semibold text-slate-950 hover:bg-emerald-100" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Opening checkout..." : "Create workspace and pay"}
              </Button>
            </div>
          </section>
        ) : null}
      </form>
    </AuthPanel>
  );
}

const steps = ["Account", "Organization", "Country", "Plan", "Finish"] as const;

const planOptions = [
  {
    plan: "STARTER" as const,
    name: "Starter",
    price: "$99",
    currencyNote: "Billed monthly in CAD for Canadian organizations.",
    features: ["1 AI agent", "500 voice minutes", "500 SMS", "5,000 chat messages"],
  },
  {
    plan: "PRO" as const,
    name: "Pro",
    price: "$199",
    currencyNote: "Billed monthly in CAD for Canadian organizations.",
    features: ["5 AI agents", "2,500 voice minutes", "2,500 SMS", "Advanced analytics"],
    recommended: true,
  },
  {
    plan: "AGENCY" as const,
    name: "Agency",
    price: "$399",
    currencyNote: "Billed monthly in CAD for Canadian organizations.",
    features: ["Unlimited AI agents", "10,000 voice minutes", "10,000 SMS", "Priority support"],
  },
];

const countryOptions = [
  {
    code: "CA" as const,
    flag: "🇨🇦",
    name: "Canada",
    telephony: "Twilio",
    payments: "Stripe",
    currency: "CAD",
    timezone: "America/Toronto",
    language: "English",
    phoneRegion: "CA",
    tax: "GST/HST",
    dateFormat: "YYYY-MM-DD",
    clock: "24 hour clock",
    recommendation: "Recommended for Canadian businesses",
  },
  {
    code: "IN" as const,
    flag: "🇮🇳",
    name: "India",
    telephony: "Exotel",
    payments: "Razorpay",
    currency: "INR",
    timezone: "Asia/Kolkata",
    language: "English",
    phoneRegion: "IN",
    tax: "GST",
    dateFormat: "DD-MM-YYYY",
    clock: "12 hour clock",
    recommendation: "Recommended for Indian businesses",
  },
];

function StepIndicator({ active }: { active: number }) {
  return (
    <ol className="grid grid-cols-5 gap-2 text-center text-xs">
      {steps.map((label, index) => (
        <li key={label} className="space-y-2">
          <div
            className={cn(
              "mx-auto flex h-8 w-8 items-center justify-center rounded-full border font-semibold transition",
              index < active
                ? "border-emerald-300 bg-emerald-300 text-slate-950"
                : index === active
                  ? "border-emerald-300/70 bg-emerald-300/10 text-emerald-100"
                  : "border-white/10 text-slate-500",
            )}
          >
            {index < active ? "✓" : index + 1}
          </div>
          <span className={index <= active ? "text-slate-100" : "text-slate-500"}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CountryPreview({ option }: { option: (typeof countryOptions)[number] }) {
  return (
    <div className="rounded-[1.35rem] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm">
      <h3 className="font-semibold text-emerald-50">{option.flag} Auto-configuration preview</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Summary label="Telephony" value={option.telephony} />
        <Summary label="Payments" value={option.payments} />
        <Summary label="Currency" value={option.currency} />
        <Summary label="Timezone" value={option.timezone} />
        <Summary label="Language" value={option.language} />
        <Summary label="Phone region" value={option.phoneRegion} />
        <Summary label="Tax" value={option.tax} />
        <Summary label="Date/Time" value={`${option.dateFormat}, ${option.clock}`} />
      </dl>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-100">{value}</dd>
    </div>
  );
}
