import {
  BadRequestException,
  Injectable,
  NotImplementedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanType, SubscriptionStatus } from "../../../../generated/prisma";
import {
  CheckoutSessionResult,
  CustomerResult,
  InvoiceResult,
  PaymentMethodResult,
  PaymentProvider,
  PaymentProviderHealthResult,
  PaymentResult,
  RefundResult,
  SetupIntentResult,
  SubscriptionResult,
  WebhookEvent,
} from "./payment-provider.interface";

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = "RAZORPAY" as const;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>("razorpay.keyId") &&
        this.config.get<string>("razorpay.keySecret") &&
        this.config.get<string>("razorpay.webhookSecret"),
    );
  }

  async createCustomer(input: {
    organizationId: string;
    email: string;
    name?: string;
    phone?: string | null;
    gstNumber?: string | null;
    billingAddress?: Record<string, unknown> | null;
  }): Promise<CustomerResult> {
    const customer = await this.request("POST", "/v1/customers", {
      name: sanitizeName(input.name) ?? "Zodo Customer",
      email: input.email,
      contact: input.phone ?? undefined,
      fail_existing: "0",
      gstin: input.gstNumber ?? undefined,
      notes: compactNotes({
        organizationId: input.organizationId,
        gstNumber: input.gstNumber,
      }),
      shipping_address: addressObject(input.billingAddress),
    });
    return this.customerResult(customer, input.email);
  }

  async updateCustomer(input: {
    customerId: string;
    email?: string;
    name?: string;
    phone?: string | null;
    gstNumber?: string | null;
    billingAddress?: Record<string, unknown> | null;
  }): Promise<CustomerResult> {
    const customer = await this.request("PATCH", `/v1/customers/${encodeURIComponent(input.customerId)}`, {
      name: sanitizeName(input.name),
      email: input.email,
      contact: input.phone ?? undefined,
      gstin: input.gstNumber ?? undefined,
      shipping_address: addressObject(input.billingAddress),
    });
    return this.customerResult(customer, input.email ?? "");
  }

  async deleteCustomer(customerId: string) {
    await this.updateCustomer({ customerId, name: "Deleted Customer" }).catch(() => undefined);
    return { id: customerId, deleted: false, provider: this.name };
  }

  async createCheckoutSession(input: {
    organizationId: string;
    customerId: string;
    priceId: string;
    plan: Exclude<PlanType, "FREE">;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    const subscription = await this.request("POST", "/v1/subscriptions", {
      plan_id: input.priceId,
      total_count: 1200,
      quantity: 1,
      customer_notify: true,
      notes: compactNotes({
        organizationId: input.organizationId,
        plan: input.plan,
        billingCustomerId: input.customerId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      }),
    });
    const url = stringValue(subscription, "short_url");
    if (!url) throw new ServiceUnavailableException("Razorpay did not return a subscription link.");
    return { id: stringValue(subscription, "id") ?? `razorpay_${Date.now()}`, url, provider: this.name };
  }

  async createSubscription(input: {
    customerId: string;
    priceId: string;
    plan?: Exclude<PlanType, "FREE">;
    organizationId?: string;
  }) {
    const subscription = await this.request("POST", "/v1/subscriptions", {
      plan_id: input.priceId,
      total_count: 1200,
      quantity: 1,
      customer_notify: true,
      notes: compactNotes({
        organizationId: input.organizationId,
        plan: input.plan,
        billingCustomerId: input.customerId,
      }),
    });
    return this.subscriptionResult(subscription);
  }

  async updateSubscription(input: {
    subscriptionId: string;
    priceId?: string;
    plan?: Exclude<PlanType, "FREE">;
  }) {
    if (!input.priceId && !input.plan) return this.getSubscription(input.subscriptionId);
    const subscription = await this.request(
      "PATCH",
      `/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}`,
      {
        ...(input.priceId ? { plan_id: input.priceId, schedule_change_at: "now" } : {}),
        ...(input.plan ? { notes: compactNotes({ plan: input.plan }) } : {}),
      },
    );
    return this.subscriptionResult(subscription);
  }

  async cancelSubscription(subscriptionId: string, mode: "IMMEDIATE" | "PERIOD_END" = "PERIOD_END") {
    const subscription = await this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { cancel_at_cycle_end: mode === "PERIOD_END" },
    );
    return this.subscriptionResult(subscription);
  }

  async resumeSubscription(subscriptionId: string) {
    const subscription = await this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/resume`,
      { resume_at: "now" },
    );
    return this.subscriptionResult(subscription);
  }

  async pauseSubscription(subscriptionId: string, resumesAt: Date) {
    const subscription = await this.request(
      "POST",
      `/v1/subscriptions/${encodeURIComponent(subscriptionId)}/pause`,
      {
        pause_at: "now",
        resume_at: Math.floor(resumesAt.getTime() / 1_000),
      },
    );
    return this.subscriptionResult(subscription, { pauseResumesAt: resumesAt });
  }

  async getSubscription(subscriptionId: string) {
    return this.subscriptionResult(
      await this.request("GET", `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`),
    );
  }

  async syncSubscriptionAddon(input: { subscriptionId: string; priceId: string; quantity: number }) {
    if (input.quantity > 0) {
      throw new NotImplementedException("Razorpay recurring add-on sync is not enabled yet.");
    }
    return { subscriptionItemId: null, unitAmountCents: 0, currency: "INR" };
  }

  async createPayment(input: {
    customerId?: string;
    amountCents: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentResult> {
    const order = await this.request("POST", "/v1/orders", {
      amount: input.amountCents,
      currency: input.currency,
      notes: input.metadata,
    });
    return {
      id: stringValue(order, "id") ?? `order_${Date.now()}`,
      amountCents: numberValue(order, "amount") ?? input.amountCents,
      currency: stringValue(order, "currency") ?? input.currency,
      status: stringValue(order, "status") ?? "created",
      provider: this.name,
    };
  }

  async refundPayment(input: { paymentId: string; amountCents?: number; reason?: string }) {
    const refund = await this.request(
      "POST",
      `/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        amount: input.amountCents,
        notes: compactNotes({ reason: input.reason }),
      },
    );
    return {
      id: stringValue(refund, "id") ?? `rfnd_${Date.now()}`,
      paymentId: stringValue(refund, "payment_id") ?? input.paymentId,
      amountCents: numberValue(refund, "amount") ?? input.amountCents ?? null,
      currency: stringValue(refund, "currency") ?? "INR",
      status: stringValue(refund, "status") ?? "processed",
      provider: this.name,
    } satisfies RefundResult;
  }

  async createInvoice(input: {
    customerId: string;
    subscriptionId?: string;
    metadata?: Record<string, string>;
  }) {
    const invoice = await this.request("POST", "/v1/invoices", {
      type: "invoice",
      customer_id: input.customerId,
      subscription_id: input.subscriptionId,
      notes: gstNotes(input.metadata),
    });
    return this.invoiceResult(invoice);
  }

  async getInvoice(invoiceId: string) {
    return this.invoiceResult(await this.request("GET", `/v1/invoices/${encodeURIComponent(invoiceId)}`));
  }

  async listInvoices(input: { customerId: string; limit?: number }) {
    const response = await this.request(
      "GET",
      `/v1/invoices?customer_id=${encodeURIComponent(input.customerId)}&count=${input.limit ?? 20}`,
    );
    return readArray(response, "items").map((invoice) => this.invoiceResult(invoice));
  }

  verifyWebhook(payload: Buffer, signature: string): WebhookEvent {
    const secret = this.config.get<string>("razorpay.webhookSecret");
    if (!secret) throw new ServiceUnavailableException("Razorpay webhooks are not configured.");
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (!safeEqual(signature, expected)) {
      throw new BadRequestException("Invalid Razorpay webhook signature.");
    }
    const parsed = JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
    const rawType = stringValue(parsed, "event") ?? "razorpay.event";
    const subscription = readEntity(parsed, "subscription");
    const payment = readEntity(parsed, "payment");
    const invoice = readEntity(parsed, "invoice");
    const eventType = normalizeWebhookType(rawType);
    return {
      id: stringValue(parsed, "id") ?? `${rawType}:${stringValue(subscription ?? payment ?? invoice ?? {}, "id") ?? Date.now()}`,
      type: eventType,
      provider: this.name,
      created: numberValue(parsed, "created_at"),
      customerId:
        stringValue(subscription ?? {}, "customer_id") ??
        stringValue(payment ?? {}, "customer_id") ??
        stringValue(invoice ?? {}, "customer_id"),
      subscriptionId:
        stringValue(subscription ?? {}, "id") ??
        stringValue(payment ?? {}, "subscription_id") ??
        stringValue(invoice ?? {}, "subscription_id"),
      subscription: subscription ? this.subscriptionResult(subscription, { rawType }) : null,
      invoice: invoice ? this.invoiceResult(invoice) : payment ? this.invoiceFromPayment(payment, eventType) : null,
      payment: payment ? this.paymentResult(payment) : null,
      payload: { ...parsed, normalizedEventType: eventType, rawEventType: rawType },
    };
  }

  async getCustomerPortal(input: { customerId: string; returnUrl: string }) {
    return {
      id: `razorpay_portal_${input.customerId}`,
      url: input.returnUrl,
      provider: this.name,
    };
  }

  async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethodResult> {
    return { id: paymentMethodId, provider: this.name };
  }

  async attachPaymentMethod(input: { customerId: string; paymentMethodId: string }) {
    return { id: input.paymentMethodId, provider: this.name };
  }

  async detachPaymentMethod(paymentMethodId: string) {
    return { id: paymentMethodId, provider: this.name };
  }

  async createSetupIntent(input: { customerId: string }): Promise<SetupIntentResult> {
    return { id: `razorpay_setup_${input.customerId}`, status: "not_required", provider: this.name };
  }

  async health(): Promise<PaymentProviderHealthResult> {
    const startedAt = Date.now();
    if (!this.keyId || !this.keySecret) {
      return { provider: this.name, configured: false, healthy: false, latencyMs: 0, status: "NOT_CONFIGURED" };
    }
    try {
      await this.request("GET", "/v1/customers?count=1");
      return {
        provider: this.name,
        configured: this.isConfigured(),
        healthy: true,
        latencyMs: Date.now() - startedAt,
        status: "ACTIVE",
        accountId: "razorpay",
      };
    } catch (error) {
      return {
        provider: this.name,
        configured: this.isConfigured(),
        healthy: false,
        latencyMs: Date.now() - startedAt,
        status: "ERROR",
        error: error instanceof Error ? error.message : "Razorpay health check failed.",
      };
    }
  }

  private subscriptionResult(
    subscription: Record<string, unknown>,
    overrides: { rawType?: string; pauseResumesAt?: Date } = {},
  ): SubscriptionResult {
    const id = requiredString(subscription, "id");
    const planId = stringValue(subscription, "plan_id") ?? "unknown";
    const now = new Date();
    const currentStart = timestampDate(numberValue(subscription, "current_start")) ?? now;
    const currentEnd =
      timestampDate(numberValue(subscription, "current_end", "end_at", "charge_at")) ??
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
    return {
      id,
      customerId: stringValue(subscription, "customer_id"),
      priceId: planId,
      plan: normalizePlan(readNotes(subscription).plan),
      status: normalizeStatus(stringValue(subscription, "status") ?? "created"),
      currentPeriodStart: currentStart,
      currentPeriodEnd: currentEnd,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_cycle_end),
      cancelledAt: timestampDate(numberValue(subscription, "ended_at")),
      pausedAt: isPaused(subscription) ? now : null,
      pauseResumesAt: overrides.pauseResumesAt ?? timestampDate(numberValue(subscription, "resume_at")),
      trialEndsAt: null,
      collectionMethod: "razorpay",
      latestInvoiceId: null,
      items: [{ priceId: planId, quantity: numberValue(subscription, "quantity") ?? 1 }],
      provider: this.name,
      providerEventCreated: numberValue(subscription, "created_at"),
    };
  }

  private invoiceResult(invoice: Record<string, unknown>): InvoiceResult {
    const notes = readNotes(invoice);
    return {
      id: stringValue(invoice, "id") ?? "unknown",
      customerId: stringValue(invoice, "customer_id"),
      subscriptionId: stringValue(invoice, "subscription_id"),
      amountDueCents: numberValue(invoice, "amount", "gross_amount"),
      amountPaidCents: numberValue(invoice, "amount_paid", "paid_amount"),
      currency: stringValue(invoice, "currency") ?? "INR",
      status: stringValue(invoice, "status"),
      hostedInvoiceUrl: stringValue(invoice, "short_url", "invoice_url"),
      provider: this.name,
      ...(notes.gstAmount ? { gstAmount: Number(notes.gstAmount) } : {}),
    } as InvoiceResult;
  }

  private invoiceFromPayment(payment: Record<string, unknown>, eventType: string): InvoiceResult {
    const amount = numberValue(payment, "amount") ?? 0;
    const succeeded = eventType === "invoice.payment_succeeded";
    return {
      id: stringValue(payment, "invoice_id") ?? stringValue(payment, "id") ?? "unknown",
      customerId: stringValue(payment, "customer_id"),
      subscriptionId: stringValue(payment, "subscription_id"),
      amountDueCents: amount,
      amountPaidCents: succeeded ? amount : 0,
      currency: stringValue(payment, "currency") ?? "INR",
      status: succeeded ? "paid" : "failed",
      provider: this.name,
    };
  }

  private paymentResult(payment: Record<string, unknown>): PaymentResult {
    return {
      id: stringValue(payment, "id") ?? "unknown",
      amountCents: numberValue(payment, "amount") ?? 0,
      currency: stringValue(payment, "currency") ?? "INR",
      status: stringValue(payment, "status") ?? "unknown",
      provider: this.name,
    };
  }

  private customerResult(customer: Record<string, unknown>, fallbackEmail: string): CustomerResult {
    return {
      id: requiredString(customer, "id"),
      email: stringValue(customer, "email") ?? fallbackEmail,
      name: stringValue(customer, "name"),
      provider: this.name,
    };
  }

  private async request(method: string, path: string, body?: Record<string, unknown>) {
    if (!this.keyId || !this.keySecret) {
      throw new ServiceUnavailableException("Razorpay billing is not configured.");
    }
    const response = await fetch(`https://api.razorpay.com${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(clean(body)) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new ServiceUnavailableException(`Razorpay API failed with ${response.status}: ${safeText(text)}`);
    }
    if (!text.trim()) return {};
    return JSON.parse(text) as Record<string, unknown>;
  }

  private get keyId() {
    return this.config.get<string>("razorpay.keyId") ?? "";
  }

  private get keySecret() {
    return this.config.get<string>("razorpay.keySecret") ?? "";
  }
}

function normalizeWebhookType(type: string) {
  const map: Record<string, string> = {
    "subscription.created": "customer.subscription.created",
    "subscription.authenticated": "customer.subscription.updated",
    "subscription.activated": "customer.subscription.updated",
    "subscription.charged": "invoice.payment_succeeded",
    "subscription.paused": "customer.subscription.updated",
    "subscription.resumed": "customer.subscription.updated",
    "subscription.cancelled": "customer.subscription.deleted",
    "subscription.completed": "customer.subscription.deleted",
    "subscription.updated": "customer.subscription.updated",
    "payment.captured": "invoice.payment_succeeded",
    "payment.authorized": "invoice.payment_succeeded",
    "payment.failed": "invoice.payment_failed",
    "refund.processed": "refund.processed",
  };
  return map[type] ?? type;
}

function normalizeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "authenticated":
      return "ACTIVE";
    case "pending":
    case "halted":
      return "PAST_DUE";
    case "cancelled":
      return "CANCELED";
    case "completed":
    case "expired":
      return "EXPIRED";
    case "created":
    default:
      return "INCOMPLETE";
  }
}

function normalizePlan(plan?: string): Exclude<PlanType, "FREE"> | null {
  if (plan === "STARTER" || plan === "PRO" || plan === "AGENCY") return plan;
  return null;
}

function readEntity(payload: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const wrapper = payload.payload;
  if (!wrapper || typeof wrapper !== "object" || Array.isArray(wrapper)) return null;
  const candidate = (wrapper as Record<string, unknown>)[key];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const entity = (candidate as Record<string, unknown>).entity;
  return entity && typeof entity === "object" && !Array.isArray(entity)
    ? (entity as Record<string, unknown>)
    : null;
}

function readArray(raw: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = raw[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    : [];
}

function readNotes(raw: Record<string, unknown>): Record<string, string> {
  const notes = raw.notes;
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return {};
  return Object.fromEntries(
    Object.entries(notes).map(([key, value]) => [key, typeof value === "string" ? value : String(value)]),
  );
}

function requiredString(raw: Record<string, unknown>, key: string) {
  const value = stringValue(raw, key);
  if (!value) throw new ServiceUnavailableException(`Razorpay response is missing ${key}.`);
  return value;
}

function stringValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function numberValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function timestampDate(value?: number | null) {
  return value ? new Date(value * 1000) : null;
}

function isPaused(subscription: Record<string, unknown>) {
  const status = stringValue(subscription, "status");
  return status === "paused" || Boolean(subscription.pause_at);
}

function sanitizeName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 50) : undefined;
}

function addressObject(value?: Record<string, unknown> | null) {
  if (!value) return undefined;
  return clean({
    line1: value.line1,
    line2: value.line2,
    city: value.city,
    state: value.state,
    country: value.country ?? "IN",
    zipcode: value.zipcode ?? value.postalCode,
  });
}

function compactNotes(value: Record<string, unknown>) {
  const cleaned = clean(value);
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function gstNotes(metadata?: Record<string, string>) {
  return compactNotes({
    ...metadata,
    taxRegion: metadata?.taxRegion ?? "IN",
    gstRate: metadata?.gstRate ?? "18",
  });
}

function clean<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function safeText(value: string) {
  return value.replace(/(key|secret|authorization|token)[^,\s}]*/gi, "$1=redacted").slice(0, 500);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
