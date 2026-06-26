import type { PlanType, SubscriptionStatus } from "../../../../generated/prisma";

export type PaymentProviderName = "STRIPE" | "RAZORPAY";
export type PaymentCountry = "CA" | "IN";

export type PaymentWebhookPayload = Record<string, unknown>;

export interface CustomerResult {
  id: string;
  email: string;
  name?: string | null;
  provider: PaymentProviderName;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  provider: PaymentProviderName;
}

export interface SubscriptionLineItemResult {
  id?: string | null;
  priceId: string;
  quantity?: number | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}

export interface SubscriptionResult {
  id: string;
  customerId?: string | null;
  priceId?: string | null;
  plan?: Exclude<PlanType, "FREE"> | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date | null;
  pausedAt?: Date | null;
  pauseResumesAt?: Date | null;
  trialEndsAt?: Date | null;
  collectionMethod?: string | null;
  latestInvoiceId?: string | null;
  items: SubscriptionLineItemResult[];
  provider: PaymentProviderName;
  providerEventCreated?: number | null;
}

export interface SubscriptionAddonResult {
  subscriptionItemId: string | null;
  unitAmountCents: number;
  currency: string;
}

export interface PaymentResult {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  provider: PaymentProviderName;
}

export interface InvoiceResult {
  id: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  amountDueCents?: number | null;
  amountPaidCents?: number | null;
  currency?: string | null;
  status?: string | null;
  hostedInvoiceUrl?: string | null;
  provider: PaymentProviderName;
}

export interface RefundResult {
  id: string;
  paymentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  status: string;
  provider: PaymentProviderName;
}

export interface PaymentMethodResult {
  id: string;
  type?: string | null;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  provider: PaymentProviderName;
}

export interface SetupIntentResult {
  id: string;
  clientSecret?: string | null;
  status?: string | null;
  provider: PaymentProviderName;
}

export interface WebhookEvent {
  id: string;
  type: string;
  provider: PaymentProviderName;
  created?: number | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  subscription?: SubscriptionResult | null;
  invoice?: InvoiceResult | null;
  payment?: PaymentResult | null;
  payload: PaymentWebhookPayload;
}

export interface PaymentProviderHealthResult {
  provider: PaymentProviderName;
  configured: boolean;
  healthy: boolean;
  latencyMs: number;
  status?: string | null;
  accountId?: string | null;
  error?: string | null;
  customers?: number | null;
  subscriptions?: number | null;
  revenueCents?: number | null;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  isConfigured(): boolean;
  createCustomer(input: {
    organizationId: string;
    email: string;
    name?: string;
    phone?: string | null;
    gstNumber?: string | null;
    billingAddress?: Record<string, unknown> | null;
  }): Promise<CustomerResult>;
  updateCustomer(input: {
    customerId: string;
    email?: string;
    name?: string;
    phone?: string | null;
    gstNumber?: string | null;
    billingAddress?: Record<string, unknown> | null;
  }): Promise<CustomerResult>;
  deleteCustomer(customerId: string): Promise<{ id: string; deleted: boolean; provider: PaymentProviderName }>;
  createCheckoutSession(input: {
    organizationId: string;
    customerId: string;
    priceId: string;
    plan: Exclude<PlanType, "FREE">;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult>;
  createSubscription(input: {
    customerId: string;
    priceId: string;
    plan?: Exclude<PlanType, "FREE">;
    organizationId?: string;
  }): Promise<SubscriptionResult>;
  updateSubscription(input: {
    subscriptionId: string;
    priceId?: string;
    plan?: Exclude<PlanType, "FREE">;
  }): Promise<SubscriptionResult>;
  cancelSubscription(
    subscriptionId: string,
    mode?: "IMMEDIATE" | "PERIOD_END",
  ): Promise<SubscriptionResult>;
  resumeSubscription(subscriptionId: string): Promise<SubscriptionResult>;
  pauseSubscription(subscriptionId: string, resumesAt: Date): Promise<SubscriptionResult>;
  getSubscription(subscriptionId: string): Promise<SubscriptionResult>;
  syncSubscriptionAddon(input: {
    subscriptionId: string;
    priceId: string;
    quantity: number;
  }): Promise<SubscriptionAddonResult>;
  createPayment(input: {
    customerId?: string;
    amountCents: number;
    currency: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentResult>;
  refundPayment(input: {
    paymentId: string;
    amountCents?: number;
    reason?: string;
  }): Promise<RefundResult>;
  createInvoice(input: {
    customerId: string;
    subscriptionId?: string;
    metadata?: Record<string, string>;
  }): Promise<InvoiceResult>;
  getInvoice(invoiceId: string): Promise<InvoiceResult>;
  listInvoices(input: { customerId: string; limit?: number }): Promise<InvoiceResult[]>;
  verifyWebhook(payload: Buffer, signature: string): WebhookEvent;
  getCustomerPortal(input: { customerId: string; returnUrl: string }): Promise<CheckoutSessionResult>;
  getPaymentMethod(paymentMethodId: string): Promise<PaymentMethodResult>;
  attachPaymentMethod(input: {
    customerId: string;
    paymentMethodId: string;
  }): Promise<PaymentMethodResult>;
  detachPaymentMethod(paymentMethodId: string): Promise<PaymentMethodResult>;
  createSetupIntent(input: { customerId: string }): Promise<SetupIntentResult>;
  health(): Promise<PaymentProviderHealthResult>;
}
