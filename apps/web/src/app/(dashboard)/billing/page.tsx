"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillableFeature, BillingPlanSummary } from "@ai-agent-platform/types";
import { Button, cn } from "@ai-agent-platform/ui";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CreditCard,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

const FEATURE_LABELS: Record<BillableFeature, string> = {
  agents: "AI agents",
  voiceMinutes: "Voice minutes",
  sms: "SMS messages",
  chatMessages: "Chat messages",
  knowledgeBases: "Knowledge bases",
  phoneNumbers: "Phone numbers",
  widgets: "Website widgets",
  campaignTargets: "Campaign targets",
};

type PaidPlan = "STARTER" | "PRO" | "AGENCY";

export default function BillingPage() {
  const queryClient = useQueryClient();
  const subscription = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: authApi.billingSubscription,
    refetchInterval: 15_000,
  });
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: authApi.billingPlans });
  const centralizedUsage = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: authApi.usageSummary,
  });
  const checkout = useMutation({
    mutationFn: authApi.createBillingCheckout,
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
  });
  const portal = useMutation({
    mutationFn: authApi.createBillingPortal,
    onSuccess: ({ portalUrl }) => window.location.assign(portalUrl),
  });
  const planChange = useMutation({
    mutationFn: authApi.changeBillingPlan,
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: authApi.cancelBillingSubscription,
    onSuccess: refresh,
  });
  const pause = useMutation({
    mutationFn: () => authApi.pauseBillingSubscription(30),
    onSuccess: refresh,
  });
  const resume = useMutation({ mutationFn: authApi.resumeBillingSubscription, onSuccess: refresh });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  }

  if (subscription.isLoading || plans.isLoading) return <SkeletonBlock className="h-[760px]" />;

  const current = subscription.data;
  const isPaid = current?.source === "SUBSCRIPTION";
  const isPaused = current?.status === "PAUSED";
  const pending = checkout.isPending || planChange.isPending;
  const actionError =
    checkout.error ||
    portal.error ||
    planChange.error ||
    cancel.error ||
    pause.error ||
    resume.error;

  const selectPlan = (plan: PaidPlan) => {
    if (isPaid) planChange.mutate(plan);
    else checkout.mutate(plan);
  };

  return (
    <div className="space-y-9">
      <PageHeader
        title="Billing"
        description="Subscription status, included usage, and account controls."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/plans">Compare plans</Link>
            </Button>
            {isPaid ? (
              <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
                <CreditCard className="h-4 w-4" />
                Billing portal
              </Button>
            ) : null}
          </div>
        }
      />

      <section className="overflow-hidden rounded-xl bg-zinc-950 text-white ring-1 ring-zinc-900 dark:ring-zinc-800">
        <div className="grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
              Plan status
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-4xl font-semibold tracking-tight">{current?.plan ?? "FREE"}</h2>
              <Status status={current?.status} cancelAtPeriodEnd={current?.cancelAtPeriodEnd} />
            </div>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              {current?.source === "TRIAL"
                ? `${daysRemaining(current.trialEndsAt)} days remain in your Starter trial. No card is required.`
                : (current?.reason ??
                  `Current period ends ${current ? formatDate(current.currentPeriodEnd) : "—"}.`)}
            </p>
            {current?.pendingPlan ? (
              <p className="mt-3 text-sm text-amber-300">
                Waiting for Stripe confirmation to activate {current.pendingPlan}.
              </p>
            ) : null}
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Period end</p>
            <p className="mt-1 font-medium tabular-nums">
              {current ? formatDate(current.currentPeriodEnd) : "—"}
            </p>
          </div>
        </div>
      </section>

      {!current?.allowed && current?.reason ? (
        <section className="flex gap-3 border-y border-amber-300 bg-amber-50 px-1 py-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Action required</p>
            <p className="mt-0.5 text-sm opacity-80">{current.reason}</p>
          </div>
        </section>
      ) : null}

      {current?.addons.phoneNumbers ? (
        <section className="flex flex-wrap items-center justify-between gap-4 border-y border-zinc-200 py-4 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium">Extra phone numbers</p>
            <p className="mt-1 text-sm text-zinc-500">
              {current.addons.phoneNumbers.quantity} billable at CA$
              {(current.addons.phoneNumbers.unitAmountCents / 100).toFixed(2)} each per month,
              prorated by Stripe.
            </p>
          </div>
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            CA$
            {(
              (current.addons.phoneNumbers.quantity * current.addons.phoneNumbers.unitAmountCents) /
              100
            ).toFixed(2)}
            /mo
          </span>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-teal-600" />
          <h2 className="text-base font-semibold">Current-period usage</h2>
        </div>
        <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {current
            ? (Object.keys(FEATURE_LABELS) as BillableFeature[]).map((feature) => (
                <UsageRow
                  key={feature}
                  label={FEATURE_LABELS[feature]}
                  used={current.usage[feature].used}
                  limit={current.usage[feature].limit}
                />
              ))
            : null}
          {centralizedUsage.data ? (
            <>
              <UsageRow
                label="Knowledge storage"
                used={centralizedUsage.data.resources.KNOWLEDGE_STORAGE_MB.used}
                limit={centralizedUsage.data.resources.KNOWLEDGE_STORAGE_MB.limit}
              />
              <UsageRow
                label="Appointments"
                used={centralizedUsage.data.resources.APPOINTMENTS.used}
                limit={centralizedUsage.data.resources.APPOINTMENTS.limit}
              />
            </>
          ) : null}
        </div>
        <Link
          href="/usage"
          className="mt-4 inline-flex text-sm font-medium text-teal-700 hover:text-teal-600"
        >
          View detailed usage and cost signals →
        </Link>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Change plan</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Changes are prorated immediately and activate after Stripe confirms them.
            </p>
          </div>
          <Link href="/plans" className="text-sm font-medium text-teal-700 hover:text-teal-600">
            Full comparison →
          </Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 lg:grid-cols-3">
          {plans.data?.map((plan) => (
            <PlanOption
              key={plan.plan}
              plan={plan}
              current={isPaid && plan.plan === current?.plan}
              pending={
                pending && (checkout.variables === plan.plan || planChange.variables === plan.plan)
              }
              overLimit={Boolean(
                isPaid &&
                current &&
                (Object.keys(plan.limits) as BillableFeature[]).some(
                  (feature) =>
                    plan.limits[feature] !== null &&
                    current.usage[feature].used > (plan.limits[feature] ?? 0),
                ),
              )}
              onSelect={() => selectPlan(plan.plan as PaidPlan)}
            />
          ))}
        </div>
        {plans.data?.some((plan) => !plan.checkoutAvailable) ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Checkout is disabled until production Stripe/Razorpay plan IDs are configured.
          </p>
        ) : null}
      </section>

      {isPaid ? (
        <section className="border-t border-zinc-200 pt-7 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Manage plan</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Keep your data while changing billing status.
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <ManageAction
              icon={isPaused ? Play : Pause}
              title={isPaused ? "Resume service" : "Pause for 30 days"}
              description={
                isPaused
                  ? "Restore collection and execution features."
                  : "Pause collection and execution features; resume automatically."
              }
              action={isPaused ? "Resume" : "Pause"}
              pending={isPaused ? resume.isPending : pause.isPending}
              onClick={() => (isPaused ? resume.mutate() : pause.mutate())}
            />
            <ManageAction
              icon={current?.cancelAtPeriodEnd ? Play : CalendarClock}
              title={current?.cancelAtPeriodEnd ? "Keep subscription" : "Cancel at period end"}
              description="Service remains active through the paid period and no data is deleted."
              action={current?.cancelAtPeriodEnd ? "Resume renewal" : "Schedule cancellation"}
              pending={cancel.isPending || resume.isPending}
              onClick={() =>
                current?.cancelAtPeriodEnd ? resume.mutate() : cancel.mutate("PERIOD_END")
              }
            />
            <ManageAction
              icon={ShieldAlert}
              title="Cancel immediately"
              description="Stops paid access now. This action cannot be resumed."
              action="Cancel now"
              destructive
              pending={cancel.isPending}
              onClick={() => {
                if (window.confirm("Cancel immediately? Paid access will stop now.")) {
                  cancel.mutate("IMMEDIATE");
                }
              }}
            />
          </div>
        </section>
      ) : null}

      {actionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {actionError.message}
        </p>
      ) : null}
    </div>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[180px_1fr_130px] sm:items-center">
      <span className="text-sm font-medium">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
        <div
          className={cn(
            "h-full rounded-full bg-teal-600 transition-[width] duration-500",
            percent >= 90 && "bg-amber-500",
          )}
          style={{ width: limit === null ? "8%" : `${percent}%` }}
        />
      </div>
      <span className="text-right text-sm tabular-nums text-zinc-500">
        {used.toLocaleString()} / {limit === null ? "Unlimited" : limit.toLocaleString()}
      </span>
    </div>
  );
}

function PlanOption({
  plan,
  current,
  pending,
  overLimit,
  onSelect,
}: {
  plan: BillingPlanSummary;
  current: boolean;
  pending: boolean;
  overLimit: boolean;
  onSelect: () => void;
}) {
  const highlights = ["agents", "voiceMinutes", "sms", "knowledgeBases"] as BillableFeature[];
  return (
    <div
      className={cn(
        "flex min-h-96 flex-col bg-white p-6 dark:bg-zinc-950",
        plan.plan === "PRO" && "bg-teal-50/60 dark:bg-teal-950/20",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{plan.displayName}</h3>
        {current ? (
          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {formatMoney(plan.monthlyPriceCents, plan.currency)}
        <span className="ml-1 text-sm font-normal text-zinc-500">/ month</span>
      </p>
      <div className="mt-7 flex-1 space-y-3">
        {highlights.map((feature) => (
          <div key={feature} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            <span>{limitLabel(plan.limits[feature], FEATURE_LABELS[feature])}</span>
          </div>
        ))}
      </div>
      {overLimit ? (
        <p className="mt-4 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          Existing data stays intact, but new activity over this plan&apos;s limits will be blocked.
        </p>
      ) : null}
      <Button
        className="mt-7 w-full"
        variant={plan.plan === "PRO" ? "default" : "outline"}
        disabled={current || !plan.checkoutAvailable || pending}
        onClick={onSelect}
      >
        {pending ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {current
          ? "Current plan"
          : plan.checkoutAvailable
            ? `Choose ${plan.displayName}`
            : "Checkout setup required"}
      </Button>
    </div>
  );
}

function ManageAction({
  icon: Icon,
  title,
  description,
  action,
  pending,
  onClick,
  destructive = false,
}: {
  icon: typeof Pause;
  title: string;
  description: string;
  action: string;
  pending: boolean;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="border-l border-zinc-200 pl-4 dark:border-zinc-800">
      <Icon className={cn("h-5 w-5 text-zinc-500", destructive && "text-red-600")} />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 min-h-10 text-sm text-zinc-500">{description}</p>
      <Button
        className={cn(
          "mt-4",
          destructive &&
            "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40",
        )}
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
        {action}
      </Button>
    </div>
  );
}

function Status({
  status,
  cancelAtPeriodEnd,
}: {
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const label = cancelAtPeriodEnd ? "Cancels at period end" : status || "Free";
  return (
    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300">
      {title(label)}
    </span>
  );
}

function title(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function limitLabel(limit: number | null, label: string) {
  return limit === null
    ? `Unlimited ${label.toLowerCase()}`
    : `${limit.toLocaleString()} ${label.toLowerCase()}`;
}
function daysRemaining(value: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}
