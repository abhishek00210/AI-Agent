"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Bot,
  CreditCard,
  DollarSign,
  LifeBuoy,
  PhoneCall,
  Search,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { adminApi } from "@/lib/admin-api";

export default function AdminDashboardPage() {
  const params = useSearchParams();
  const searchTerm = params.get("search") ?? "";
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    staleTime: 30_000,
  });
  const search = useQuery({
    queryKey: ["admin-search", searchTerm],
    queryFn: () => adminApi.search(searchTerm),
    enabled: searchTerm.length >= 2,
  });
  const cards = useMemo(() => {
    const totals = dashboard.data?.totals;
    return [
      ["Organizations", totals?.organizations ?? 0, Building2],
      ["Users", totals?.users ?? 0, Users],
      ["Agents", totals?.agents ?? 0, Bot],
      ["Calls", totals?.calls ?? 0, PhoneCall],
      ["Revenue", money(totals?.revenue ?? 0), DollarSign],
      ["MRR", money(totals?.mrr ?? 0), CreditCard],
      ["Active subs", totals?.activeSubscriptions ?? 0, CreditCard],
      ["Open tickets", totals?.openSupportTickets ?? 0, LifeBuoy],
    ] as const;
  }, [dashboard.data]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-teal-300">Global platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Super Admin Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tenant-isolated customer platform data, visible only through audited admin access.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
              <Icon className="h-4 w-4 text-teal-300" /> {label}
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
        ))}
      </section>
      {searchTerm ? (
        <section className="rounded-2xl border border-white/10 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-teal-300" />
            <h2 className="font-semibold">Search results for “{searchTerm}”</h2>
          </div>
          <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-zinc-400">
            {JSON.stringify(search.data ?? {}, null, 2)}
          </pre>
        </section>
      ) : null}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-5">
          <h2 className="font-semibold">Recent organizations</h2>
          <div className="mt-4 divide-y divide-white/10">
            {(dashboard.data?.recentOrganizations ?? []).map((org) => (
              <div key={org.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-xs text-zinc-500">
                    {org.plan} · {org.status}
                  </p>
                </div>
                <time className="text-xs text-zinc-500">
                  {new Date(org.createdAt).toLocaleDateString()}
                </time>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          <h2 className="font-semibold">Subscription distribution</h2>
          <pre className="mt-4 rounded-xl bg-black/40 p-4 text-xs text-zinc-400">
            {JSON.stringify(dashboard.data?.subscriptionDistribution ?? {}, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
}
