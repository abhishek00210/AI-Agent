"use client";
import { useQuery } from "@tanstack/react-query";
import { Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { authApi } from "@/lib/auth-api";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const customers = useQuery({ queryKey: ["customers", search], queryFn: () => authApi.customers(search), staleTime: 30_000 });
  return <div className="space-y-7"><PageHeader title="Customers" description="Unified profiles resolved from calls, appointments, leads, messages, and conversations." />
    <label className="flex max-w-xl items-center gap-3 border-b border-zinc-300 py-3 dark:border-zinc-700"><Search className="h-4 w-4 text-zinc-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search name, phone, email, or company" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {!customers.data?.length ? <EmptyState icon={UsersRound} title="No customer profiles" description="Profiles appear automatically when customers interact with your AI employees." /> : <div className="overflow-x-auto border-y border-zinc-200 dark:border-zinc-800"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Calls</th><th className="px-4 py-3">Appointments</th><th className="px-4 py-3">Last contact</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{customers.data.map((customer) => <tr key={customer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"><td className="px-4 py-4"><Link className="font-medium text-teal-600" href={`/customers/${customer.id}`}>{customer.name}</Link><div className="text-xs text-zinc-500">{customer.email}</div></td><td className="px-4 py-4 font-mono">{customer.phone ?? "—"}</td><td className="px-4 py-4">{customer.company ?? "—"}</td><td className="px-4 py-4">{customer.leadStatus}</td><td className="px-4 py-4">{customer.totalCalls}</td><td className="px-4 py-4">{customer.totalAppointments}</td><td className="px-4 py-4">{date(customer.lastContactAt)}</td></tr>)}</tbody></table></div>}
  </div>;
}
function date(value: string | null) { return value ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value)) : "—"; }

