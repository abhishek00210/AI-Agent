"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BillableFeature,
  BillingCapability,
  BillingPlanSummary,
} from "@ai-agent-platform/types";
import { Button, cn } from "@ai-agent-platform/ui";
import { Check, Minus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

type PaidPlan = "STARTER" | "PRO" | "AGENCY";

const LIMITS: Array<[BillableFeature, string]> = [
  ["agents", "AI agents"],
  ["voiceMinutes", "Voice minutes / month"],
  ["sms", "SMS / month"],
  ["chatMessages", "Chat messages / month"],
  ["knowledgeBases", "Knowledge bases"],
  ["phoneNumbers", "Phone numbers"],
  ["widgets", "Website widgets"],
];
const CAPABILITIES: Array<[BillingCapability, string]> = [
  ["googleCalendar", "Google Calendar"],
  ["appointments", "Appointment booking"],
  ["crm", "CRM"],
  ["apiAccess", "API access"],
  ["prioritySupport", "Priority support"],
  ["advancedAnalytics", "Advanced analytics"],
];

export default function PlansPage() {
  const queryClient = useQueryClient();
  const subscription = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: authApi.billingSubscription,
  });
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: authApi.billingPlans });
  const checkout = useMutation({
    mutationFn: authApi.createBillingCheckout,
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
  });
  const change = useMutation({
    mutationFn: authApi.changeBillingPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing"] }),
  });

  if (subscription.isLoading || plans.isLoading) return <SkeletonBlock className="h-[760px]" />;
  const current = subscription.data;
  const isPaid = current?.source === "SUBSCRIPTION";
  const select = (plan: PaidPlan) => (isPaid ? change.mutate(plan) : checkout.mutate(plan));
  const error = subscription.error || plans.error || checkout.error || change.error;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Plans"
        description="Monthly CAD pricing with immediate, prorated plan changes."
      />

      <section className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 lg:grid-cols-3">
        {plans.data?.map((plan) => (
          <PricingColumn
            key={plan.plan}
            plan={plan}
            current={isPaid && plan.plan === current?.plan}
            busy={checkout.isPending || change.isPending}
            overLimit={Boolean(
              isPaid &&
              current &&
              (Object.keys(plan.limits) as BillableFeature[]).some(
                (feature) =>
                  plan.limits[feature] !== null &&
                  current.usage[feature].used > (plan.limits[feature] ?? 0),
              ),
            )}
            onSelect={() => select(plan.plan as PaidPlan)}
          />
        ))}
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-base font-semibold">Feature comparison</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Higher plans include the capabilities of the plans before them.
          </p>
        </div>
        <div className="overflow-x-auto border-y border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-4 pr-4 font-medium text-zinc-500">Included</th>
                {plans.data?.map((plan) => (
                  <th key={plan.plan} className="px-4 py-4 text-center font-semibold">
                    {plan.displayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {LIMITS.map(([key, label]) => (
                <tr key={key}>
                  <th className="py-4 pr-4 text-left font-medium">{label}</th>
                  {plans.data?.map((plan) => (
                    <td
                      key={plan.plan}
                      className="px-4 py-4 text-center tabular-nums text-zinc-600 dark:text-zinc-400"
                    >
                      {formatLimit(plan.limits[key])}
                    </td>
                  ))}
                </tr>
              ))}
              {CAPABILITIES.map(([key, label]) => (
                <tr key={key}>
                  <th className="py-4 pr-4 text-left font-medium">{label}</th>
                  {plans.data?.map((plan) => (
                    <td key={plan.plan} className="px-4 py-4 text-center">
                      {plan.capabilities[key] ? (
                        <Check className="mx-auto h-4 w-4 text-teal-600" aria-label="Included" />
                      ) : (
                        <Minus
                          className="mx-auto h-4 w-4 text-zinc-300"
                          aria-label="Not included"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}
      {plans.data?.some((plan) => !plan.checkoutAvailable) ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Checkout is not active until production Stripe/Razorpay plan IDs are configured.
        </p>
      ) : null}
    </div>
  );
}

function PricingColumn({
  plan,
  current,
  busy,
  overLimit,
  onSelect,
}: {
  plan: BillingPlanSummary;
  current: boolean;
  busy: boolean;
  overLimit: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        "flex min-h-[430px] flex-col bg-white p-7 dark:bg-zinc-950",
        plan.plan === "PRO" && "bg-teal-50/60 dark:bg-teal-950/20",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{plan.displayName}</h2>
        {current ? (
          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            Current plan
          </span>
        ) : null}
      </div>
      <p className="mt-6 text-4xl font-semibold tracking-tight">
        {formatMoney(plan.monthlyPriceCents, plan.currency)}
        <span className="ml-1 text-sm font-normal text-zinc-500">/mo</span>
      </p>
      <p className="mt-2 text-sm text-zinc-500">Billed monthly in Canadian dollars.</p>
      <div className="mt-8 flex-1 space-y-3">
        {LIMITS.slice(0, 5).map(([key, label]) => (
          <p key={key} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Check className="h-4 w-4 shrink-0 text-teal-600" />
            {formatLimit(plan.limits[key])} {label.toLowerCase().replace(" / month", "")}
          </p>
        ))}
      </div>
      {overLimit ? (
        <p className="mt-4 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          Downgrading keeps existing data and blocks new activity above these limits.
        </p>
      ) : null}
      <Button
        className="mt-7 w-full"
        variant={plan.plan === "PRO" ? "default" : "outline"}
        disabled={current || busy || !plan.checkoutAvailable}
        onClick={onSelect}
      >
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
        {current
          ? "Current plan"
          : plan.checkoutAvailable
            ? `Choose ${plan.displayName}`
            : "Checkout setup required"}
      </Button>
    </article>
  );
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString();
}
