"use client";

import type {
  MarketplacePhoneNumber,
  MarketplaceSearchQuery,
  PhoneNumberDetails,
  PhoneNumberStatus,
} from "@ai-agent-platform/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Phone, Plus, RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, cn } from "@ai-agent-platform/ui";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SkeletonBlock } from "@/components/layout/page-loader";
import { formatAgentStatus } from "@/lib/agent-options";
import { authApi } from "@/lib/auth-api";

const statuses: Array<"ALL" | PhoneNumberStatus> = ["ALL", "ACTIVE", "UNASSIGNED", "INACTIVE"];
const countries: Array<{
  value: MarketplaceSearchQuery["country"];
  label: string;
  provider: "Twilio" | "Exotel";
  currency: "CA$" | "₹";
  hint: string;
}> = [
  {
    value: "CA",
    label: "Canada",
    provider: "Twilio",
    currency: "CA$",
    hint: "Canadian numbers route through Twilio.",
  },
  {
    value: "IN",
    label: "India",
    provider: "Exotel",
    currency: "₹",
    hint: "Indian numbers route through Exotel.",
  },
];

export default function PhoneNumbersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | PhoneNumberStatus>("ALL");
  const [assigning, setAssigning] = useState<PhoneNumberDetails | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [marketplaceQuery, setMarketplaceQuery] = useState<MarketplaceSearchQuery>({
    country: "CA",
    type: "local",
    voice: true,
    sms: true,
    limit: 20,
  });
  const organization = useQuery({
    queryKey: ["current-organization", "phone-number-marketplace"],
    queryFn: () => authApi.currentOrganization(),
  });
  const selectedCountry = countries.find((country) => country.value === marketplaceQuery.country) ?? countries[0];

  useEffect(() => {
    const organizationCountry = organization.data?.country;
    if (organizationCountry === "CA" || organizationCountry === "IN") {
      setMarketplaceQuery((current) =>
        current.country === organizationCountry ? current : { ...current, country: organizationCountry },
      );
    }
  }, [organization.data?.country]);

  const phoneNumbers = useQuery({
    queryKey: ["phone-numbers", { search, status }],
    queryFn: () =>
      authApi.phoneNumbers({
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
        limit: 50,
      }),
  });
  const agents = useQuery({
    queryKey: ["agents", "phone-number-options"],
    queryFn: () => authApi.agents({ limit: 100 }),
  });
  const activeAgents = useMemo(
    () => agents.data?.data.filter((agent) => agent.status !== "INACTIVE") ?? [],
    [agents.data?.data],
  );

  const sync = useMutation({
    mutationFn: authApi.syncPhoneNumbers,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const assign = useMutation({
    mutationFn: (input: { phoneNumberId: string; agentId: string }) =>
      authApi.assignPhoneNumberAgent(input.phoneNumberId, { agentId: input.agentId }),
    onSuccess: () => {
      setAssigning(null);
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const unassign = useMutation({
    mutationFn: authApi.unassignPhoneNumber,
    onSuccess: () => {
      setAssigning(null);
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const enable = useMutation({
    mutationFn: authApi.enablePhoneNumber,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const disable = useMutation({
    mutationFn: authApi.disablePhoneNumber,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const marketplace = useMutation({
    mutationFn: () => authApi.searchMarketplaceNumbers(marketplaceQuery),
  });
  const purchase = useMutation({
    mutationFn: (number: MarketplacePhoneNumber) =>
      authApi.purchaseMarketplaceNumber({
        phoneNumber: number.phoneNumber,
        country: marketplaceQuery.country,
        areaCode: marketplaceQuery.areaCode,
        agentId: activeAgents[0]?.id,
      }),
    onSuccess: () => {
      setBuyOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });
  const release = useMutation({
    mutationFn: authApi.releaseMarketplaceNumber,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["phone-numbers"] });
      void queryClient.invalidateQueries({ queryKey: ["voice-dashboard"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phone Numbers"
        description="Buy provider-backed numbers, manage status, and assign numbers to AI agents."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Sync Provider Numbers
            </Button>
            <Button onClick={() => setBuyOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buy Number
            </Button>
          </div>
        }
      />

      <section className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              className={inputClassName + " pl-9"}
              placeholder="Search number, name, or country"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className={inputClassName + " md:w-48"}
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | PhoneNumberStatus)}
          >
            {statuses.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All statuses" : formatStatus(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">Phone Number</th>
                <th className="px-6 py-3 font-medium">Assigned Agent</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Country</th>
                <th className="px-6 py-3 font-medium">Capabilities</th>
                <th className="px-6 py-3 font-medium">Monthly</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {phoneNumbers.isLoading ? <RowsSkeleton /> : null}
              {phoneNumbers.data?.data.map((number) => (
                <tr key={number.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium">{number.phoneNumber}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {number.friendlyName ?? number.twilioSid}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {number.agent ? (
                      <div>
                        <div className="font-medium">{number.agent.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formatAgentStatus(number.agent.status)} · {number.agent.language}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={number.status} />
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {number.countryCode ?? number.country ?? "Unknown"}
                  </td>
                  <td className="px-6 py-4">
                    <Capabilities capabilities={number.capabilities} />
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {number.customerPrice
                      ? formatMoney(number.customerPrice, number.countryCode === "IN" ? "IN" : "CA")
                      : number.monthlyCost
                        ? formatMoney(number.monthlyCost, number.countryCode === "IN" ? "IN" : "CA")
                        : "—"}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {new Date(number.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/voice/phone-numbers/${number.id}`}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAssigning(number)}>
                        Assign
                      </Button>
                      {number.status === "INACTIVE" ? (
                        <Button
                          size="sm"
                          disabled={enable.isPending}
                          onClick={() => enable.mutate(number.id)}
                        >
                          Enable
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={disable.isPending}
                          onClick={() => disable.mutate(number.id)}
                        >
                          Disable
                        </Button>
                      )}
                      {number.isPurchased && !number.releasedAt ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={release.isPending}
                          onClick={() => {
                            if (confirm(`Release ${number.phoneNumber} from ${providerLabel(number.provider)}?`)) {
                              release.mutate(number.id);
                            }
                          }}
                        >
                          Release
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!phoneNumbers.isLoading && phoneNumbers.data?.data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Phone}
              title="No phone numbers synced"
              description="Verify Twilio credentials, then sync numbers from your Twilio account."
            />
          </div>
        ) : null}
      </section>

      {assigning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold">Assign Agent</h2>
            <p className="mt-1 text-sm text-zinc-500">{assigning.phoneNumber}</p>
            <div className="mt-5 space-y-3">
              {activeAgents.map((agent) => (
                <button
                  key={agent.id}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  onClick={() => assign.mutate({ phoneNumberId: assigning.id, agentId: agent.id })}
                >
                  <span>
                    <span className="block font-medium">{agent.name}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {formatAgentStatus(agent.status)} · {agent.language}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-500">{agent.voice}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {assigning.agentId ? (
                <Button
                  variant="outline"
                  disabled={unassign.isPending}
                  onClick={() => unassign.mutate(assigning.id)}
                >
                  Unassign
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setAssigning(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {buyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Buy Number</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Search {selectedCountry.provider} inventory, purchase a number, and activate it
                  for existing AI call routing.
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {selectedCountry.hint} Your organization country controls which provider is used.
                </p>
              </div>
              <Button variant="outline" onClick={() => setBuyOpen(false)}>
                Close
              </Button>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-6">
              <select
                className={inputClassName}
                value={marketplaceQuery.country}
                onChange={(event) =>
                  setMarketplaceQuery((current) => ({
                    ...current,
                    country: event.target.value as MarketplaceSearchQuery["country"],
                  }))
                }
              >
                {countries.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label} · {country.provider}
                  </option>
                ))}
              </select>
              <input
                className={inputClassName}
                placeholder="Area code"
                value={marketplaceQuery.areaCode ?? ""}
                onChange={(event) =>
                  setMarketplaceQuery((current) => ({
                    ...current,
                    areaCode: event.target.value || undefined,
                  }))
                }
              />
              <input
                className={inputClassName}
                placeholder="Contains"
                value={marketplaceQuery.contains ?? ""}
                onChange={(event) =>
                  setMarketplaceQuery((current) => ({
                    ...current,
                    contains: event.target.value || undefined,
                  }))
                }
              />
              <select
                className={inputClassName}
                value={marketplaceQuery.type ?? "local"}
                onChange={(event) =>
                  setMarketplaceQuery((current) => ({
                    ...current,
                    type: event.target.value as MarketplaceSearchQuery["type"],
                  }))
                }
              >
                <option value="local">Local</option>
                <option value="toll-free">Toll Free</option>
                <option value="mobile">Mobile</option>
              </select>
              <label className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={Boolean(marketplaceQuery.sms)}
                  onChange={(event) =>
                    setMarketplaceQuery((current) => ({ ...current, sms: event.target.checked }))
                  }
                />
                SMS
              </label>
              <Button disabled={marketplace.isPending} onClick={() => marketplace.mutate()}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
            </div>

            {marketplace.error ? (
              <MarketplaceError
                title="Number search failed"
                error={marketplace.error}
                country={marketplaceQuery.country}
              />
            ) : null}
            {purchase.error ? (
              <MarketplaceError
                title={`${selectedCountry.provider} could not purchase this number`}
                error={purchase.error}
                country={marketplaceQuery.country}
              />
            ) : null}

            <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Phone Number</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">Capabilities</th>
                    <th className="px-4 py-3 font-medium">Provider Cost</th>
                    <th className="px-4 py-3 font-medium">Customer Price</th>
                    <th className="px-4 py-3 font-medium">Margin</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {marketplace.data?.data.map((number) => (
                    <tr key={number.phoneNumber}>
                      <td className="px-4 py-3 font-medium">{number.phoneNumber}</td>
                      <td className="px-4 py-3 text-zinc-500">{providerLabel(number.provider)}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {[number.locality, number.region, number.country].filter(Boolean).join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <Capabilities capabilities={number.capabilities} />
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {formatMoney(number.providerCost, marketplaceQuery.country)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {formatMoney(number.customerPrice, marketplaceQuery.country)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {formatMoney(number.profitMargin, marketplaceQuery.country)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          disabled={purchase.isPending}
                          onClick={() => {
                            purchase.reset();
                            purchase.mutate(number);
                          }}
                        >
                          {purchase.isPending ? "Purchasing…" : "Purchase"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!marketplace.isPending && marketplace.data?.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                        No matching {selectedCountry.provider} numbers found.
                      </td>
                    </tr>
                  ) : null}
                  {marketplace.isPending ? <RowsSkeleton /> : null}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Purchased numbers are configured with provider voice and SMS webhooks automatically.
              Assign an agent during or after purchase to activate AI call handling.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClassName =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600";

function StatusBadge({ status }: { status: PhoneNumberStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        status === "ACTIVE" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        status === "UNASSIGNED" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        status === "INACTIVE" && "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
      )}
    >
      {formatStatus(status)}
    </span>
  );
}

function Capabilities({ capabilities }: { capabilities: PhoneNumberDetails["capabilities"] }) {
  const items = [
    capabilities.voice ? "Voice" : null,
    capabilities.sms ? "SMS" : null,
    capabilities.mms ? "MMS" : null,
  ].filter(Boolean);
  return <span className="text-zinc-500">{items.length ? items.join(", ") : "None"}</span>;
}

function RowsSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <tr key={index}>
      {Array.from({ length: 8 }).map((__, cell) => (
        <td key={cell} className="px-6 py-4">
          <SkeletonBlock className="h-5" />
        </td>
      ))}
    </tr>
  ));
}

function formatStatus(status: PhoneNumberStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function MarketplaceError({
  title,
  error,
  country,
}: {
  title: string;
  error: Error;
  country: MarketplaceSearchQuery["country"];
}) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1">{error.message}</p>
      <p className="mt-2 text-xs opacity-80">{countryPurchaseGuidance(country)}</p>
    </div>
  );
}

function countryPurchaseGuidance(country: MarketplaceSearchQuery["country"]) {
  switch (country) {
    case "IN":
      return "Confirm Exotel credentials are configured and that the selected Indian number is available for purchase in your Exotel account.";
    case "CA":
    default:
      return "Confirm your Twilio account is upgraded, has sufficient balance, and is permitted to purchase Canadian numbers.";
  }
}

function providerLabel(provider: PhoneNumberDetails["provider"]) {
  return provider === "EXOTEL" ? "Exotel" : "Twilio";
}

function formatMoney(value: number, country: MarketplaceSearchQuery["country"]) {
  if (country === "IN") return `₹${value.toFixed(2)}`;
  return `CA$${value.toFixed(2)}`;
}
