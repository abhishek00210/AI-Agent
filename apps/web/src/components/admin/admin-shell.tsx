"use client";

import {
  BarChart3,
  Activity,
  Bot,
  Brain,
  Building2,
  CreditCard,
  FileText,
  Headphones,
  LifeBuoy,
  LogOut,
  PhoneCall,
  PhoneForwarded,
  Receipt,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { useAdminAuthStore } from "@/store/admin-auth-store";

const nav = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/performance", label: "Performance", icon: Activity },
  { href: "/admin/providers", label: "Providers", icon: RadioTower },
  { href: "/admin/payment-providers", label: "Payments", icon: CreditCard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/agents", label: "Agents", icon: Bot },
  { href: "/admin/calls", label: "Calls", icon: PhoneCall },
  { href: "/admin/outbound-calls", label: "Outbound Calls", icon: PhoneForwarded },
  { href: "/admin/campaigns", label: "Campaigns", icon: PhoneForwarded },
  { href: "/admin/lead-imports", label: "Lead Imports", icon: Users },
  { href: "/admin/call-summaries", label: "AI Summaries", icon: Sparkles },
  { href: "/admin/customer-memory", label: "Customer Memory", icon: Brain },
  { href: "/admin/automations", label: "Automations", icon: Workflow },
  { href: "/admin/phone-numbers", label: "Numbers", icon: PhoneCall },
  { href: "/admin/external-numbers", label: "Forwarding", icon: PhoneForwarded },
  { href: "/admin/port-requests", label: "Port Requests", icon: PhoneCall },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/knowledge", label: "Knowledge", icon: FileText },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/audit", label: "Audit", icon: ShieldCheck },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAdminAuthStore((state) => state.admin);
  const clear = useAdminAuthStore((state) => state.clearSession);
  const [q, setQ] = useState("");

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-black/30 px-5 py-6 xl:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-400 text-zinc-950">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Zodo Super Admin</p>
            <p className="text-xs text-zinc-500">Global control plane</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-white text-zinc-950"
                    : "text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="xl:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/85 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:w-[460px]">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && q.trim())
                    router.push(`/admin?search=${encodeURIComponent(q.trim())}`);
                }}
                placeholder="Global search organizations, users, agents, calls..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
              />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Headphones className="h-4 w-4 text-teal-400" />
              <span className="text-zinc-400">{admin?.email}</span>
              <button
                onClick={() => {
                  clear();
                  router.replace("/admin-login");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-zinc-300 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </header>
        <div className="px-5 py-8">{children}</div>
      </main>
    </div>
  );
}
