import { Injectable, NotImplementedException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import type { PlanType, SubscriptionStatus } from "../../../../generated/prisma";
import {
  CheckoutSessionResult,
  CustomerResult,
  InvoiceResult,
  PaymentMethodResult,
  PaymentProvider,
  PaymentResult,
  RefundResult,
  SetupIntentResult,
  SubscriptionResult,
  WebhookEvent,
} from "./payment-provider.interface";

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = "STRIPE" as const;
  private readonly stripe?: Stripe;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>("stripe.secretKey");
    if (secretKey) this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 10_000 });
  }

  isConfigured() {
    return Boolean(this.stripe && this.config.get<string>("stripe.webhookSecret"));
  }

  async createCustomer(input: { organizationId: string; email: string; name?: string }) {
    const customer = await this.client.customers.create(
      {
        email: input.email,
        name: input.name,
        metadata: { organizationId: input.organizationId },
      },
      { idempotencyKey: `billing-customer-${input.organizationId}` },
    );
    return this.customerResult(customer, input.email);
  }

  async updateCustomer(input: { customerId: string; email?: string; name?: string }) {
    const customer = await this.client.customers.update(input.customerId, {
      email: input.email,
      name: input.name,
    });
    return this.customerResult(customer, input.email ?? "");
  }

  async deleteCustomer(customerId: string) {
    const deleted = await this.client.customers.del(customerId);
    return { id: deleted.id, deleted: Boolean(deleted.deleted), provider: this.name };
  }

  async createCheckoutSession(input: {
    organizationId: string;
    customerId: string;
    priceId: string;
    plan: Exclude<PlanType, "FREE">;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    const session = await this.client.checkout.sessions.create({
      mode: "subscription",
      customer: input.customerId,
      client_reference_id: input.organizationId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
      metadata: { organizationId: input.organizationId, plan: input.plan },
      subscription_data: {
        metadata: { organizationId: input.organizationId, plan: input.plan },
      },
    });
    if (!session.url) {
      throw new ServiceUnavailableException("Stripe did not return a checkout URL.");
    }
    return { id: session.id, url: session.url, provider: this.name };
  }

  async getCustomerPortal(input: { customerId: string; returnUrl: string }) {
    const session = await this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { id: session.id, url: session.url, provider: this.name };
  }

  async createSubscription(input: {
    customerId: string;
    priceId: string;
    plan?: Exclude<PlanType, "FREE">;
    organizationId?: string;
  }) {
    const subscription = await this.client.subscriptions.create({
      customer: input.customerId,
      items: [{ price: input.priceId }],
      metadata: {
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        ...(input.plan ? { plan: input.plan } : {}),
      },
    });
    return this.subscriptionResult(subscription);
  }

  async updateSubscription(input: {
    subscriptionId: string;
    priceId?: string;
    plan?: Exclude<PlanType, "FREE">;
  }) {
    if (!input.priceId && !input.plan) return this.getSubscription(input.subscriptionId);
    const current = await this.client.subscriptions.retrieve(input.subscriptionId);
    const item = current.items.data[0];
    if (!item && input.priceId) {
      throw new ServiceUnavailableException("Stripe subscription has no billable item.");
    }
    const subscription = await this.client.subscriptions.update(input.subscriptionId, {
      ...(input.priceId ? { items: [{ id: item.id, price: input.priceId }] } : {}),
      proration_behavior: input.priceId ? "always_invoice" : undefined,
      metadata: input.plan ? { ...current.metadata, plan: input.plan } : current.metadata,
    });
    return this.subscriptionResult(subscription);
  }

  cancelSubscription(subscriptionId: string, mode: "IMMEDIATE" | "PERIOD_END" = "PERIOD_END") {
    if (mode === "IMMEDIATE") {
      return this.client.subscriptions.cancel(subscriptionId).then((subscription) =>
        this.subscriptionResult(subscription),
      );
    }
    return this.client.subscriptions
      .update(subscriptionId, { cancel_at_period_end: true })
      .then((subscription) => this.subscriptionResult(subscription));
  }

  pauseSubscription(subscriptionId: string, resumesAt: Date) {
    return this.client.subscriptions
      .update(subscriptionId, {
        pause_collection: {
          behavior: "void",
          resumes_at: Math.floor(resumesAt.getTime() / 1_000),
        },
      })
      .then((subscription) => this.subscriptionResult(subscription));
  }

  resumeSubscription(subscriptionId: string) {
    return this.client.subscriptions
      .update(subscriptionId, {
        cancel_at_period_end: false,
        pause_collection: "",
      })
      .then((subscription) => this.subscriptionResult(subscription));
  }

  getSubscription(subscriptionId: string) {
    return this.client.subscriptions
      .retrieve(subscriptionId, { expand: ["items.data.price"] })
      .then((subscription) => this.subscriptionResult(subscription));
  }

  async syncSubscriptionAddon(input: { subscriptionId: string; priceId: string; quantity: number }) {
    const subscription = await this.client.subscriptions.retrieve(input.subscriptionId, {
      expand: ["items.data.price"],
    });
    const existing = subscription.items.data.find((item) => item.price.id === input.priceId);
    const price = existing?.price ?? (await this.client.prices.retrieve(input.priceId));
    if (price.unit_amount === null) {
      throw new ServiceUnavailableException("Stripe phone-number price has no unit amount.");
    }
    if (input.quantity <= 0) {
      if (existing) {
        await this.client.subscriptionItems.del(existing.id, {
          proration_behavior: "always_invoice",
        });
      }
      return {
        subscriptionItemId: null,
        unitAmountCents: price.unit_amount,
        currency: price.currency.toUpperCase(),
      };
    }
    if (existing) {
      const item = await this.client.subscriptionItems.update(existing.id, {
        quantity: input.quantity,
        proration_behavior: "always_invoice",
      });
      return {
        subscriptionItemId: item.id,
        unitAmountCents: price.unit_amount,
        currency: price.currency.toUpperCase(),
      };
    }
    const item = await this.client.subscriptionItems.create({
      subscription: input.subscriptionId,
      price: input.priceId,
      quantity: input.quantity,
      proration_behavior: "always_invoice",
    });
    return {
      subscriptionItemId: item.id,
      unitAmountCents: price.unit_amount,
      currency: price.currency.toUpperCase(),
    };
  }

  createPayment(): Promise<PaymentResult> {
    throw new NotImplementedException("Direct Stripe payment creation is not enabled.");
  }

  async refundPayment(input: { paymentId: string; amountCents?: number; reason?: string }) {
    const refund = await this.client.refunds.create({
      payment_intent: input.paymentId,
      amount: input.amountCents,
      reason: stripeRefundReason(input.reason),
    });
    return {
      id: refund.id,
      paymentId: stripeId(refund.payment_intent),
      amountCents: refund.amount,
      currency: refund.currency?.toUpperCase(),
      status: refund.status ?? "unknown",
      provider: this.name,
    } satisfies RefundResult;
  }

  async createInvoice(input: {
    customerId: string;
    subscriptionId?: string;
    metadata?: Record<string, string>;
  }) {
    const invoice = await this.client.invoices.create({
      customer: input.customerId,
      subscription: input.subscriptionId,
      metadata: input.metadata,
    } as Stripe.InvoiceCreateParams);
    return this.invoiceResult(invoice);
  }

  async getInvoice(invoiceId: string) {
    return this.invoiceResult(await this.client.invoices.retrieve(invoiceId));
  }

  async listInvoices(input: { customerId: string; limit?: number }) {
    const invoices = await this.client.invoices.list({
      customer: input.customerId,
      limit: input.limit ?? 20,
    });
    return invoices.data.map((invoice) => this.invoiceResult(invoice));
  }

  verifyWebhook(payload: Buffer, signature: string): WebhookEvent {
    const secret = this.config.get<string>("stripe.webhookSecret");
    if (!secret) throw new ServiceUnavailableException("Stripe webhooks are not configured.");
    const tolerance = this.config.get<number>("stripe.webhookToleranceSeconds") ?? 300;
    const event = this.client.webhooks.constructEvent(payload, signature, secret, tolerance);
    return this.webhookEvent(event);
  }

  async getPaymentMethod(paymentMethodId: string) {
    return this.paymentMethodResult(await this.client.paymentMethods.retrieve(paymentMethodId));
  }

  async attachPaymentMethod(input: { customerId: string; paymentMethodId: string }) {
    return this.paymentMethodResult(
      await this.client.paymentMethods.attach(input.paymentMethodId, {
        customer: input.customerId,
      }),
    );
  }

  async detachPaymentMethod(paymentMethodId: string) {
    return this.paymentMethodResult(await this.client.paymentMethods.detach(paymentMethodId));
  }

  async createSetupIntent(input: { customerId: string }): Promise<SetupIntentResult> {
    const intent = await this.client.setupIntents.create({ customer: input.customerId });
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      provider: this.name,
    };
  }

  async health() {
    const startedAt = Date.now();
    if (!this.stripe) {
      return {
        provider: this.name,
        configured: false,
        healthy: false,
        latencyMs: 0,
        status: "NOT_CONFIGURED",
      };
    }
    try {
      await this.client.balance.retrieve();
      return {
        provider: this.name,
        configured: this.isConfigured(),
        healthy: true,
        latencyMs: Date.now() - startedAt,
        status: "ACTIVE",
        accountId: "stripe",
      };
    } catch (error) {
      return {
        provider: this.name,
        configured: this.isConfigured(),
        healthy: false,
        latencyMs: Date.now() - startedAt,
        status: "ERROR",
        error: error instanceof Error ? error.message : "Stripe health check failed.",
      };
    }
  }

  private webhookEvent(event: Stripe.Event): WebhookEvent {
    const object = event.data.object as StripeObjectWithIds;
    const subscriptionObject = event.type.startsWith("customer.subscription.")
      ? (event.data.object as Stripe.Subscription)
      : undefined;
    const invoiceObject = event.type.startsWith("invoice.")
      ? (event.data.object as Stripe.Invoice)
      : undefined;
    return {
      id: event.id,
      type: event.type,
      provider: this.name,
      created: event.created,
      customerId: stripeId(object.customer),
      subscriptionId:
        stripeId(object.subscription) ??
        stripeId(object.parent?.subscription_details?.subscription) ??
        subscriptionObject?.id,
      subscription: subscriptionObject
        ? this.subscriptionResult(subscriptionObject, event.created)
        : null,
      invoice: invoiceObject ? this.invoiceResult(invoiceObject) : null,
      payload: event as unknown as Record<string, unknown>,
    };
  }

  private subscriptionResult(
    subscription: Stripe.Subscription,
    providerEventCreated?: number,
  ): SubscriptionResult {
    const items = subscription.items.data.map((item) => ({
      id: item.id,
      priceId: item.price.id,
      quantity: item.quantity,
      currentPeriodStart: timestampDate(subscriptionItemPeriod(item).start),
      currentPeriodEnd: timestampDate(subscriptionItemPeriod(item).end),
    }));
    const baseItem = items[0];
    const period = subscriptionPeriod(subscription, subscription.items.data[0]);
    return {
      id: subscription.id,
      customerId: stripeId(subscription.customer),
      priceId: baseItem?.priceId ?? null,
      plan: normalizePlan(subscription.metadata.plan),
      status: normalizeStatus(subscription.status),
      currentPeriodStart: new Date(period.start * 1000),
      currentPeriodEnd: new Date(period.end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: timestampDate(subscription.canceled_at),
      pausedAt: subscription.pause_collection ? new Date() : null,
      pauseResumesAt: timestampDate(subscription.pause_collection?.resumes_at),
      trialEndsAt: timestampDate(subscription.trial_end),
      collectionMethod: subscription.collection_method,
      latestInvoiceId: stripeId(subscription.latest_invoice),
      items,
      provider: this.name,
      providerEventCreated,
    };
  }

  private invoiceResult(invoice: Stripe.Invoice): InvoiceResult {
    return {
      id: invoice.id ?? "unknown",
      customerId: stripeId(invoice.customer),
      subscriptionId: stripeId(
        (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null })
          .subscription,
      ),
      amountDueCents: invoice.amount_due,
      amountPaidCents: invoice.amount_paid,
      currency: invoice.currency?.toUpperCase(),
      status: invoice.status,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      provider: this.name,
    };
  }

  private customerResult(customer: Stripe.Customer | Stripe.DeletedCustomer, fallbackEmail: string) {
    return {
      id: customer.id,
      email: "email" in customer && customer.email ? customer.email : fallbackEmail,
      name: "name" in customer ? customer.name : null,
      provider: this.name,
    } satisfies CustomerResult;
  }

  private paymentMethodResult(method: Stripe.PaymentMethod): PaymentMethodResult {
    return {
      id: method.id,
      type: method.type,
      brand: method.card?.brand,
      last4: method.card?.last4,
      expMonth: method.card?.exp_month,
      expYear: method.card?.exp_year,
      provider: this.name,
    };
  }

  private get client() {
    if (!this.stripe) throw new ServiceUnavailableException("Stripe billing is not configured.");
    return this.stripe;
  }
}

interface StripeObjectWithIds {
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } };
}

function normalizePlan(plan?: string): Exclude<PlanType, "FREE"> | null {
  if (plan === "STARTER" || plan === "PRO" || plan === "AGENCY") return plan;
  return null;
}

function normalizeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "paused":
      return "PAST_DUE";
    case "unpaid":
      return "UNPAID";
    case "incomplete":
      return "INCOMPLETE";
    case "canceled":
      return "CANCELED";
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "INCOMPLETE";
  }
}

function subscriptionPeriod(subscription: Stripe.Subscription, baseItem?: Stripe.SubscriptionItem) {
  const current = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const item = baseItem as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const start = current.current_period_start ?? item?.current_period_start;
  const end = current.current_period_end ?? item?.current_period_end;
  if (!start || !end) throw new ServiceUnavailableException("Stripe subscription period is unavailable.");
  return { start, end };
}

function subscriptionItemPeriod(item: Stripe.SubscriptionItem) {
  const withPeriod = item as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: withPeriod.current_period_start,
    end: withPeriod.current_period_end,
  };
}

function timestampDate(value?: number | null) {
  return value ? new Date(value * 1000) : null;
}

function stripeId(value: string | { id: string } | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function stripeRefundReason(reason?: string): Stripe.RefundCreateParams.Reason | undefined {
  if (reason === "duplicate" || reason === "fraudulent" || reason === "requested_by_customer") {
    return reason;
  }
  return undefined;
}
