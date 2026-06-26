import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PlanType } from "../../../generated/prisma";
import type { PaymentProviderName } from "../payments/providers/payment-provider.interface";
import type { TenantContext } from "../tenant/tenant.service";
import { BillingQueueService } from "./billing-queue.service";
import { BillingRepository } from "./billing.repository";
import { FeatureGateService, PLAN_CAPABILITIES, PLAN_LIMITS } from "./feature-gate.service";
import { PaymentProviderFactory } from "../payments/payment-provider.factory";

@Injectable()
export class BillingService {
  constructor(
    private readonly config: ConfigService,
    private readonly billing: BillingRepository,
    private readonly gates: FeatureGateService,
    private readonly queue: BillingQueueService,
    private readonly payments: PaymentProviderFactory,
  ) {}

  isConfigured() {
    return this.provider().isConfigured();
  }

  capabilities() {
    return {
      provider: this.provider().name,
      configured: this.isConfigured(),
      checkout: true,
      portal: true,
      changePlan: true,
      immediateCancellation: true,
      periodEndCancellation: true,
      pause: true,
      webhookAuthoritative: true,
    };
  }

  async checkout(context: TenantContext, plan: Exclude<PlanType, "FREE">) {
    this.assertCanManage(context);
    const provider = await this.providerForOrganization(context.organizationId);
    if (!provider.isConfigured())
      throw new BadRequestException("Payment provider billing is not configured.");
    const existing = await this.billing.currentSubscription(context.organizationId);
    if (existing && !["CANCELED", "EXPIRED"].includes(existing.status)) {
      throw new BadRequestException("Use change plan for an existing subscription.");
    }
    const settings = await this.billing.organizationBillingSettings(context.organizationId);
    const priceId = this.priceForPlan(plan, provider.name);
    let customer = await this.billing.findCustomer(context.organizationId, provider.name);
    if (!customer) {
      const created = await provider.createCustomer({
        organizationId: context.organizationId,
        email: context.email,
        name: settings?.billingCompanyName ?? undefined,
        gstNumber: settings?.gstNumber ?? undefined,
        billingAddress:
          settings?.billingAddress &&
          typeof settings.billingAddress === "object" &&
          !Array.isArray(settings.billingAddress)
            ? (settings.billingAddress as Record<string, unknown>)
            : undefined,
      });
      customer = await this.billing.upsertCustomer({
        organizationId: context.organizationId,
        provider: created.provider,
        providerCustomerId: created.id,
        email: created.email,
      });
    }
    const appUrl = this.config.getOrThrow<string>("api.appUrl").replace(/\/$/, "");
    const session = await provider.createCheckoutSession({
      organizationId: context.organizationId,
      customerId: customer.providerCustomerId,
      priceId,
      plan,
      successUrl: `${appUrl}/billing?checkout=complete`,
      cancelUrl: `${appUrl}/billing?checkout=cancelled`,
    });
    await this.billing.createAudit({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: "billing.checkout_started",
      entityType: "BillingCustomer",
      entityId: customer.id,
      metadata: { provider: session.provider, plan, checkoutSessionId: session.id },
    });
    return { checkoutUrl: session.url };
  }

  async portal(context: TenantContext) {
    this.assertCanManage(context);
    const provider = await this.providerForOrganization(context.organizationId);
    const customer = await this.billing.findCustomer(context.organizationId, provider.name);
    if (!customer) throw new NotFoundException("Billing customer not found.");
    const returnUrl = `${this.config.getOrThrow<string>("api.appUrl").replace(/\/$/, "")}/billing`;
    const session = await provider.getCustomerPortal({
      customerId: customer.providerCustomerId,
      returnUrl,
    });
    return { portalUrl: session.url };
  }

  async subscription(context: TenantContext) {
    const [subscription, phoneNumberAddon] = await Promise.all([
      this.billing.currentSubscription(context.organizationId),
      this.billing.phoneNumberAddon(context.organizationId),
    ]);
    const entitlements = await this.gates.resolve(context.organizationId);
    const periodStart = new Date(entitlements.periodStart);
    return {
      provider: subscription?.provider ?? (await this.providerForOrganization(context.organizationId)).name,
      plan: entitlements.plan,
      status: publicState(entitlements.state),
      source: entitlements.source,
      allowed: entitlements.allowed,
      reason: entitlements.reason,
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date(entitlements.periodEnd),
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      cancelledAt: subscription?.cancelledAt ?? null,
      pausedAt: subscription?.pausedAt ?? null,
      pauseResumesAt: subscription?.pauseResumesAt ?? null,
      pendingPlan: subscription?.pendingPlan ?? null,
      trialEndsAt: entitlements.trialEndsAt,
      usage: await this.gates.usage(context.organizationId),
      capabilities: entitlements.capabilities,
      addons: {
        phoneNumbers: phoneNumberAddon
          ? {
              status: phoneNumberAddon.status,
              quantity: phoneNumberAddon.quantity,
              unitAmountCents: phoneNumberAddon.unitAmountCents,
              currency: phoneNumberAddon.currency,
              lastSyncedAt: phoneNumberAddon.lastSyncedAt,
            }
          : null,
      },
    };
  }

  async assertPhoneNumberPurchase(organizationId: string) {
    const [entitlements, inventory, subscription] = await Promise.all([
      this.gates.resolve(organizationId),
      this.billing.activePhoneNumberInventory(organizationId),
      this.billing.currentSubscription(organizationId),
    ]);
    if (!entitlements.allowed) {
      throw new ForbiddenException(entitlements.reason ?? "Billing access is unavailable.");
    }
    const included = entitlements.limits.phoneNumbers;
    if (included === null || inventory.total + 1 <= included) {
      return { included: true, owned: inventory.total, includedQuantity: included };
    }
    if (
      entitlements.source !== "SUBSCRIPTION" ||
      !subscription ||
      !["ACTIVE", "TRIALING"].includes(subscription.status)
    ) {
      throw new ForbiddenException(
        "Upgrade to a paid plan before purchasing an additional phone number.",
      );
    }
    if (!this.phoneNumberPriceId(subscription.provider)) {
      throw new BadRequestException("Additional phone-number billing is not configured.");
    }
    return { included: false, owned: inventory.total, includedQuantity: included };
  }

  async schedulePhoneNumberAddonSync(organizationId: string) {
    try {
      await this.queue.enqueuePhoneNumberSync(organizationId);
      return { queued: true };
    } catch (error) {
      await this.billing.createAudit({
        organizationId,
        action: "billing.phone_number_addon_sync_failed",
        entityType: "BillingAddon",
        metadata: {
          retryScheduled: Boolean(this.config.get<string>("redis.url")),
          error: error instanceof Error ? error.message.slice(0, 300) : "Unknown billing error",
        },
      });
      return { queued: false };
    }
  }

  async plans() {
    const stripePrices = this.config.get<Record<string, string>>("stripe.prices") ?? {};
    const razorpayPlans = this.config.get<Record<string, string>>("razorpay.plans") ?? {};
    const stored = await this.billing.billingPlans();
    const byPlan = new Map(stored.map((record) => [record.plan, record]));
    return (["STARTER", "PRO", "AGENCY"] as PlanType[]).map((plan) => {
      const record = byPlan.get(plan);
      return {
        plan,
        displayName: record?.displayName ?? title(plan),
        monthlyPriceCents: record?.monthlyPriceCents ?? priceCents(plan),
        currency: record?.currency ?? "CAD",
        limits: PLAN_LIMITS[plan],
        capabilities: PLAN_CAPABILITIES[plan],
        checkoutAvailable: Boolean(stripePrices[plan] || razorpayPlans[plan]),
      };
    });
  }

  async changePlan(context: TenantContext, plan: Exclude<PlanType, "FREE">) {
    this.assertCanManage(context);
    return this.requestPlanChange(context.organizationId, plan, context.userId);
  }

  adminChangePlan(organizationId: string, plan: Exclude<PlanType, "FREE">) {
    return this.requestPlanChange(organizationId, plan);
  }

  private async requestPlanChange(
    organizationId: string,
    plan: Exclude<PlanType, "FREE">,
    actorUserId?: string,
  ) {
    const subscription = await this.requireSubscription(organizationId);
    if (!["ACTIVE", "TRIALING"].includes(subscription.status)) {
      throw new BadRequestException("Only an active subscription can change plans.");
    }
    if (subscription.plan === plan) throw new BadRequestException("This plan is already active.");
    const priceId = this.priceForPlan(plan, subscription.provider);
    await this.billing.updatePendingPlan(subscription.id, plan);
    try {
      await this.provider(subscription.provider).updateSubscription({
        subscriptionId: subscription.providerSubscriptionId,
        priceId,
        plan,
      });
    } catch (error) {
      await this.billing.updatePendingPlan(subscription.id, null);
      throw error;
    }
    await this.billing.createAudit({
      organizationId,
      actorUserId,
      action: "billing.plan_change_requested",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { from: subscription.plan, to: plan, proration: "ALWAYS_INVOICE" },
    });
    return { accepted: true, pendingWebhook: true, plan };
  }

  async cancel(context: TenantContext, mode: "IMMEDIATE" | "PERIOD_END" = "PERIOD_END") {
    this.assertCanManage(context);
    return this.requestCancellation(context.organizationId, mode, context.userId);
  }

  adminCancel(organizationId: string, mode: "IMMEDIATE" | "PERIOD_END" = "PERIOD_END") {
    return this.requestCancellation(organizationId, mode);
  }

  private async requestCancellation(
    organizationId: string,
    mode: "IMMEDIATE" | "PERIOD_END",
    actorUserId?: string,
  ) {
    const subscription = await this.requireSubscription(organizationId);
    await this.provider(subscription.provider).cancelSubscription(
      subscription.providerSubscriptionId,
      mode,
    );
    await this.billing.createAudit({
      organizationId,
      actorUserId,
      action:
        mode === "IMMEDIATE"
          ? "billing.immediate_cancellation_requested"
          : "billing.cancellation_requested",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { mode },
    });
    return { accepted: true, pendingWebhook: true, mode };
  }

  async pause(context: TenantContext, days: number) {
    this.assertCanManage(context);
    const subscription = await this.requireSubscription(context.organizationId);
    if (!["ACTIVE", "TRIALING"].includes(subscription.status) || subscription.pausedAt) {
      throw new BadRequestException("Only an active, unpaused subscription can be paused.");
    }
    const resumesAt = new Date(Date.now() + days * 24 * 60 * 60 * 1_000);
    await this.provider(subscription.provider).pauseSubscription(
      subscription.providerSubscriptionId,
      resumesAt,
    );
    await this.billing.createAudit({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: "billing.pause_requested",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: { days, resumesAt },
    });
    return { accepted: true, pendingWebhook: true, resumesAt };
  }

  async resume(context: TenantContext) {
    this.assertCanManage(context);
    return this.requestResume(context.organizationId, context.userId);
  }

  adminResume(organizationId: string) {
    return this.requestResume(organizationId);
  }

  private async requestResume(organizationId: string, actorUserId?: string) {
    const subscription = await this.requireSubscription(organizationId);
    await this.provider(subscription.provider).resumeSubscription(subscription.providerSubscriptionId);
    await this.billing.createAudit({
      organizationId,
      actorUserId,
      action: "billing.resume_requested",
      entityType: "Subscription",
      entityId: subscription.id,
    });
    return { accepted: true, pendingWebhook: true };
  }

  entitlements(context: TenantContext) {
    return this.gates.resolve(context.organizationId);
  }

  monitoring() {
    return this.queue.depth();
  }

  private priceForPlan(plan: Exclude<PlanType, "FREE">, provider: string = this.provider().name) {
    const prefix = provider === "RAZORPAY" ? "razorpay.plans" : "stripe.prices";
    const price = this.config.get<string>(`${prefix}.${plan}`);
    if (!price) throw new BadRequestException(`${plan} pricing is not configured.`);
    return price;
  }

  private provider(provider?: string | null) {
    return this.payments.byName(provider);
  }

  private async providerForOrganization(organizationId: string) {
    const settings = await this.billing.organizationBillingSettings(organizationId);
    return this.payments.resolve({
      organizationCountry: settings?.country ?? settings?.countryCode,
      provider: settings?.paymentProvider,
    });
  }

  private phoneNumberPriceId(provider: string | PaymentProviderName) {
    const prefix = provider === "RAZORPAY" ? "razorpay.plans" : "stripe.prices";
    return this.config.get<string>(`${prefix}.PHONE_NUMBER`)?.trim() || "";
  }

  private async requireSubscription(organizationId: string) {
    const subscription = await this.billing.currentSubscription(organizationId);
    if (!subscription) throw new NotFoundException("Subscription not found.");
    return subscription;
  }

  private assertCanManage(context: TenantContext) {
    if (context.role !== "OWNER" && context.role !== "ADMIN") {
      throw new ForbiddenException("Billing can only be managed by organization administrators.");
    }
  }
}

function publicState(state: string) {
  if (state === "TRIALING") return "TRIAL";
  if (state === "CANCELED") return "CANCELLED";
  return state;
}

function priceCents(plan: PlanType) {
  return { FREE: 0, STARTER: 9_900, PRO: 19_900, AGENCY: 39_900 }[plan];
}

function title(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
