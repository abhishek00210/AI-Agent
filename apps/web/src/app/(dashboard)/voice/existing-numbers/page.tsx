"use client";

import type {
  ExternalNumberVerificationMethod,
  ExternalPhoneNumber,
} from "@ai-agent-platform/types";
import { Button, cn } from "@ai-agent-platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CircleDashed,
  Copy,
  PhoneForwarded,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { authApi } from "@/lib/auth-api";

const countries = [
  { value: "CA", label: "Canada" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
] as const;

export default function ExistingNumbersPage() {
  const queryClient = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const numbers = useQuery({
    queryKey: ["external-numbers"],
    queryFn: authApi.externalNumbers,
    refetchInterval: wizardOpen ? 3_000 : false,
  });
  const selected = numbers.data?.data.find((number) => number.id === selectedId) ?? null;

  const openSetup = (number?: ExternalPhoneNumber) => {
    setSelectedId(number?.id ?? null);
    setWizardOpen(true);
  };

  if (numbers.isLoading) return <SkeletonBlock className="h-[640px]" />;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Existing Numbers"
        description="Keep your business number and forward calls to an assigned AI agent."
        action={
          <Button onClick={() => openSetup()}>
            <Plus className="h-4 w-4" />
            Add Existing Number
          </Button>
        }
      />

      <section className="border-y border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-2 divide-x divide-zinc-200 py-5 dark:divide-zinc-800 md:grid-cols-4">
          <Metric label="Configured" value={numbers.data?.total ?? 0} />
          <Metric
            label="Active"
            value={numbers.data?.data.filter((number) => number.status === "ACTIVE").length ?? 0}
          />
          <Metric
            label="Awaiting test"
            value={numbers.data?.data.filter((number) => number.status === "VERIFIED").length ?? 0}
          />
          <Metric
            label="Needs attention"
            value={numbers.data?.data.filter((number) => number.status === "FAILED").length ?? 0}
          />
        </div>
      </section>

      {!numbers.data?.data.length ? (
        <EmptyState
          icon={PhoneForwarded}
          title="No existing numbers connected"
          description="Verify your current business number, forward it to Twilio, and test the AI route."
          action={
            <Button onClick={() => openSetup()}>
              <Plus className="h-4 w-4" />
              Add Existing Number
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto border-y border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Business number</th>
                <th className="px-4 py-3 font-medium">Assigned agent</th>
                <th className="px-4 py-3 font-medium">Forward to</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">Last test</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {numbers.data.data.map((number) => (
                <tr
                  key={number.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-4 font-medium tabular-nums">{number.phoneNumber}</td>
                  <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400">
                    {number.assignedAgent?.name ?? "Not assigned"}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {number.forwardingTargetNumber ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    <Status value={number.status} />
                  </td>
                  <td className="px-4 py-4 text-zinc-500">{formatDate(number.verifiedAt)}</td>
                  <td className="px-4 py-4 text-zinc-500">{formatDate(number.lastTestCallAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => openSetup(number)}>
                      {number.status === "ACTIVE" ? "Manage" : "Continue setup"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {wizardOpen ? (
        <SetupWizard
          number={selected}
          onCreated={(record) => {
            setSelectedId(record.id);
            void queryClient.invalidateQueries({ queryKey: ["external-numbers"] });
          }}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["external-numbers"] })}
          onClose={() => {
            setWizardOpen(false);
            setSelectedId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SetupWizard({
  number,
  onCreated,
  onRefresh,
  onClose,
}: {
  number: ExternalPhoneNumber | null;
  onCreated: (record: ExternalPhoneNumber) => void;
  onRefresh: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState<"CA" | "US" | "GB" | "AU">("CA");
  const [method, setMethod] = useState<ExternalNumberVerificationMethod>("SMS");
  const [otp, setOtp] = useState("");
  const agents = useQuery({
    queryKey: ["agents", "external-number-options"],
    queryFn: () => authApi.agents({ limit: 100 }),
  });
  const activeAgents = useMemo(
    () => agents.data?.data.filter((agent) => agent.status === "ACTIVE") ?? [],
    [agents.data?.data],
  );
  const create = useMutation({
    mutationFn: () =>
      authApi.createExternalNumber({ phoneNumber, countryCode, verificationMethod: method }),
    onSuccess: onCreated,
  });
  const verify = useMutation({
    mutationFn: () => authApi.verifyExternalNumber(number!.id, otp),
    onSuccess: async () => {
      setOtp("");
      await onRefresh();
    },
  });
  const resend = useMutation({
    mutationFn: () => authApi.resendExternalNumberOtp(number!.id, method),
  });
  const assign = useMutation({
    mutationFn: (agentId: string) => authApi.assignExternalNumber(number!.id, agentId),
    onSuccess: onRefresh,
  });
  const test = useMutation({
    mutationFn: () => authApi.startExternalNumberTest(number!.id),
    onSuccess: onRefresh,
  });
  const disable = useMutation({
    mutationFn: () => authApi.disableExternalNumber(number!.id),
    onSuccess: async () => {
      await onRefresh();
      onClose();
    },
  });
  const step = currentStep(number);
  const error =
    create.error || verify.error || resend.error || assign.error || test.error || disable.error;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full w-full max-w-2xl animate-in slide-in-from-right duration-200 flex-col bg-white shadow-2xl dark:bg-zinc-950">
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">Setup</p>
            <h2 className="mt-1 text-xl font-semibold">Forward an existing number</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Complete each check before the route becomes active.
            </p>
          </div>
          <button
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            onClick={onClose}
            aria-label="Close setup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="grid grid-cols-6 gap-2">
            {["Add", "Verify", "Assign", "Forward", "Test", "Active"].map((label, index) => (
              <div key={label}>
                <div
                  className={cn(
                    "h-1 rounded-full bg-zinc-200 transition-colors dark:bg-zinc-800",
                    index + 1 <= step && "bg-teal-600 dark:bg-teal-500",
                  )}
                />
                <p
                  className={cn(
                    "mt-2 text-[11px] text-zinc-400",
                    index + 1 === step && "font-medium text-zinc-900 dark:text-white",
                  )}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-7">
          {!number ? (
            <div className="space-y-5">
              <StepTitle
                number="01"
                title="Add your business number"
                description="Use the number customers already call. International E.164 format is recommended."
              />
              <label className="block text-sm font-medium">
                Business phone number
                <input
                  className={inputClass}
                  placeholder="+1 416 555 0123"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value.replace(/[\s()-]/g, ""))}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Country
                  <select
                    className={inputClass}
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value as typeof countryCode)}
                  >
                    {countries.map((country) => (
                      <option key={country.value} value={country.value}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Verify by
                  <select
                    className={inputClass}
                    value={method}
                    onChange={(event) =>
                      setMethod(event.target.value as ExternalNumberVerificationMethod)
                    }
                  >
                    <option value="SMS">SMS code</option>
                    <option value="VOICE">Voice call</option>
                  </select>
                </label>
              </div>
              <Button disabled={!phoneNumber || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "Adding…" : "Add and send code"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : step === 2 ? (
            <div className="space-y-5">
              <StepTitle
                number="02"
                title="Verify ownership"
                description={`Enter the six-digit code sent by ${number.verificationMethod.toLowerCase()} to ${number.phoneNumber}.`}
              />
              {number.verificationDelivery?.sent === false ? (
                <Notice tone="danger">
                  {number.verificationDelivery.error ?? "The code could not be delivered."}
                </Notice>
              ) : null}
              <input
                className={inputClass + " max-w-xs text-center font-mono text-2xl tracking-[0.3em]"}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={otp.length !== 6 || verify.isPending}
                  onClick={() => verify.mutate()}
                >
                  Verify number
                </Button>
                <Button
                  variant="outline"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Resend code
                </Button>
              </div>
            </div>
          ) : step === 3 ? (
            <div className="space-y-5">
              <StepTitle
                number="03"
                title="Assign an AI agent"
                description="The agent must already have an active Twilio number; that number becomes the forwarding destination."
              />
              {!activeAgents.length ? (
                <Notice tone="danger">
                  Create an active agent and assign it a Twilio number before continuing.
                </Notice>
              ) : null}
              <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {activeAgents.map((agent) => (
                  <button
                    key={agent.id}
                    className="flex w-full items-center justify-between py-4 text-left hover:text-teal-700"
                    onClick={() => assign.mutate(agent.id)}
                  >
                    <span>
                      <span className="block font-medium">{agent.name}</span>
                      <span className="text-sm text-zinc-500">{agent.language}</span>
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : step === 4 ? (
            <ForwardingStep
              number={number}
              onContinue={() => test.mutate()}
              pending={test.isPending}
            />
          ) : step === 5 ? (
            <div className="space-y-5">
              <StepTitle
                number="05"
                title="Waiting for a forwarded call"
                description="Call your existing number from another phone. The test passes when the media stream reaches the assigned agent."
              />
              <div className="flex items-center gap-3 border-y border-zinc-200 py-5 dark:border-zinc-800">
                <CircleDashed className="h-6 w-6 animate-spin text-teal-600" />
                <div>
                  <p className="font-medium">Listening for the test call</p>
                  <p className="text-sm text-zinc-500">
                    Window ends {formatDateTime(number.testExpiresAt)}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => void onRefresh()}>
                <RefreshCw className="h-4 w-4" />
                Check status
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <BadgeCheck className="h-8 w-8" />
              </div>
              <StepTitle
                number="06"
                title="Forwarding is active"
                description={`${number.phoneNumber} successfully reached ${number.assignedAgent?.name ?? "the assigned AI agent"}.`}
              />
              <div className="border-y border-zinc-200 py-4 text-sm dark:border-zinc-800">
                <p className="text-zinc-500">Forwarding destination</p>
                <p className="mt-1 font-mono font-medium">{number.forwardingTargetNumber}</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={onClose}>Done</Button>
                <Button variant="outline" onClick={() => test.mutate()}>
                  Retest forwarding
                </Button>
              </div>
            </div>
          )}

          {error ? (
            <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error.message}
            </p>
          ) : null}
        </div>

        {number ? (
          <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 text-xs text-zinc-500 dark:border-zinc-800">
            <span>{number.phoneNumber}</span>
            {number.status !== "DISABLED" ? (
              <button
                className="hover:text-red-600"
                onClick={() => {
                  if (
                    window.confirm(
                      "Disable this external number? Existing forwarding at your carrier must also be turned off.",
                    )
                  )
                    disable.mutate();
                }}
              >
                Disable number
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ForwardingStep({
  number,
  onContinue,
  pending,
}: {
  number: ExternalPhoneNumber;
  onContinue: () => void;
  pending: boolean;
}) {
  const instructions = number.forwardingInstructions;
  if (!instructions) return <Notice tone="danger">No forwarding target is assigned.</Notice>;
  return (
    <div className="space-y-6">
      <StepTitle
        number="04"
        title="Enable call forwarding"
        description="Configure unconditional forwarding with your carrier before starting the test."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Data label="Existing number" value={number.phoneNumber} />
        <Data label="Forward calls to" value={instructions.target} copy />
      </div>
      <div className="border-y border-zinc-200 py-5 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Common carrier code
        </p>
        <p className="mt-2 font-mono text-xl font-semibold">{instructions.enableCode}</p>
        <p className="mt-2 text-sm text-zinc-500">{instructions.notes[0]}</p>
      </div>
      <ol className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        {instructions.steps.map((item, index) => (
          <li key={item} className="flex gap-3">
            <span className="font-mono text-teal-700">0{index + 1}</span>
            {item}
          </li>
        ))}
      </ol>
      <Button disabled={pending} onClick={onContinue}>
        <ShieldCheck className="h-4 w-4" />I enabled forwarding — start test
      </Button>
    </div>
  );
}

function StepTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs text-teal-700">{number}</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
function Data({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="font-mono font-medium">{value}</p>
        {copy ? (
          <button onClick={() => void navigator.clipboard.writeText(value)} aria-label="Copy">
            <Copy className="h-4 w-4 text-zinc-400" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
function Notice({ children, tone }: { children: ReactNode; tone: "danger" }) {
  return (
    <p
      className={cn(
        "border-l-2 px-4 py-3 text-sm",
        tone === "danger" &&
          "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      )}
    >
      {children}
    </p>
  );
}
function Status({ value }: { value: ExternalPhoneNumber["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        value === "ACTIVE"
          ? "text-emerald-700"
          : value === "FAILED" || value === "DISABLED"
            ? "text-red-600"
            : "text-amber-700",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value.replaceAll("_", " ")}
    </span>
  );
}
function currentStep(number: ExternalPhoneNumber | null) {
  if (!number) return 1;
  if (!number.verifiedAt) return 2;
  if (!number.assignedAgentId || !number.forwardingTargetNumber) return 3;
  if (number.status === "ACTIVE" && number.forwardingConfirmedAt) return 6;
  if (number.testStatus === "WAITING_FOR_CALL") return 5;
  return 4;
}
function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}
function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}
const inputClass =
  "mt-2 h-11 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 dark:border-zinc-700";
