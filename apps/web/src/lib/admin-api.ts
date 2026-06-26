"use client";

import { webEnv } from "@/config/env";
import { useAdminAuthStore } from "@/store/admin-auth-store";

const apiBaseUrl = `${webEnv.NEXT_PUBLIC_API_URL}/api/v1`;

interface AdminRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function adminRequest<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (!options.skipAuth) {
    const token = useAdminAuthStore.getState().accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) useAdminAuthStore.getState().clearSession();
    throw new Error(await readError(response));
  }
  return response.json() as Promise<T>;
}

export const adminApi = {
  async login(input: { email: string; password: string }) {
    const response = await adminRequest<{
      accessToken: string;
      admin: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: "SUPER_ADMIN";
      };
    }>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
      skipAuth: true,
    });
    useAdminAuthStore.getState().setSession(response);
    return response;
  },
  me() {
    return adminRequest<{ admin: unknown }>("/admin/auth/me");
  },
  dashboard() {
    return adminRequest<AdminDashboard>("/admin/dashboard");
  },
  list(resource: string, query = "") {
    return adminRequest<unknown[]>(`/admin/${resource}${query ? `?${query}` : ""}`);
  },
  customerTimeline(customerId: string, query = "") {
    return adminRequest<{ customer: unknown; data: unknown[]; nextCursor: string | null }>(
      `/admin/customers/${customerId}/timeline${query ? `?${query}` : ""}`,
    );
  },
  customerMemory(customerId: string) {
    return adminRequest<unknown>(`/admin/customers/${customerId}/memory-context`);
  },
  search(q: string) {
    return adminRequest<Record<string, unknown[]>>(`/admin/search?q=${encodeURIComponent(q)}`);
  },
  performance() {
    return adminRequest<PerformanceAuditReport>("/admin/performance");
  },
  providers() {
    return adminRequest<TelephonyProvidersReport>("/admin/providers");
  },
  paymentProviders() {
    return adminRequest<PaymentProvidersReport>("/admin/payment-providers");
  },
  patch(path: string, body: unknown) {
    return adminRequest<unknown>(path, { method: "PATCH", body: JSON.stringify(body) });
  },
  post(path: string, body: unknown = {}) {
    return adminRequest<unknown>(path, { method: "POST", body: JSON.stringify(body) });
  },
  delete(path: string, body: unknown) {
    return adminRequest<unknown>(path, { method: "DELETE", body: JSON.stringify(body) });
  },
};

export interface AdminDashboard {
  totals: {
    organizations: number;
    users: number;
    agents: number;
    calls: number;
    revenue: number;
    mrr: number;
    activeSubscriptions: number;
    trialAccounts: number;
    openSupportTickets: number;
  };
  subscriptionDistribution: Record<string, number>;
  recentOrganizations: Array<{
    id: string;
    name: string;
    status: string;
    plan: string;
    createdAt: string;
  }>;
}

export interface PerformanceAuditReport {
  generatedAt: string;
  launchRecommendation: "PASS" | "PARTIAL" | "FAIL";
  gates: Array<{
    key: string;
    label: string;
    targetMs: number;
    metric: string;
    status: "PASS" | "FAIL" | "UNKNOWN";
    sampleCount: number;
    p50: number;
    p95: number;
    p99: number;
    note?: string;
  }>;
  cache: {
    routingHitRate: number;
    globalHitRate: number;
    counters: Record<string, number>;
  };
  eventLoopLagMs: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  queues: Array<{
    name: string;
    waiting: number;
    delayed: number;
    failed: number;
    status: "OK" | "BACKLOG" | "UNKNOWN";
  }>;
  bottlenecks: string[];
  knownLimitations: string[];
}

export interface TelephonyProvidersReport {
  generatedAt: string;
  data: Array<{
    provider: "TWILIO" | "EXOTEL";
    configured: boolean;
    healthy: boolean;
    latencyMs: number;
    status?: string | null;
    accountSid?: string | null;
    error?: string | null;
  }>;
}

export interface PaymentProvidersReport {
  generatedAt: string;
  data: Array<{
    provider: "STRIPE" | "RAZORPAY";
    configured: boolean;
    healthy: boolean;
    latencyMs: number;
    status?: string | null;
    accountId?: string | null;
    error?: string | null;
    customers?: number | null;
    subscriptions?: number | null;
    revenueCents?: number | null;
  }>;
}

async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload.message ?? payload.error ?? "Admin request failed.";
  } catch {
    return "Admin request failed.";
  }
}
