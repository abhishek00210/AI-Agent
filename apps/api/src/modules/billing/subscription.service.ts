import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { PlanType, Prisma } from "../../../generated/prisma";
import { BillingRepository } from "./billing.repository";
import { FeatureGateService } from "./feature-gate.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { PaymentProviderFactory } from "../payments/payment-provider.factory";
import type {
  SubscriptionLineItemResult,
  SubscriptionResult,
  WebhookEvent,
} from "../payments/providers/payment-provider.interface";

const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "refund.processed",
]);

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly billing: BillingRepository,
    private readonly config: ConfigService,
    private readonly payments: PaymentProviderFactory,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  supports(eventType: string) {
    return SUPPORTED_EVENTS.has(eventType);
  }

  async processVerifiedEvent(event: WebhookEvent, organizationId: string) {
    const reserved = await this.billing.reserveEvent({
      organizationId,
      provider: event.provider,
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Prisma.InputJsonValue,
    });
    if (reserved.processed) return { duplicate: true };

    const providerSubscription = await this.subscriptionForEvent(event);
    const customerId = providerSubscription?.customerId ?? event.customerId;
    const customer = customerId
      ? await this.billing.findCustomerByProviderId(customerId, event.provider)
      : undefined;
    if (customer && customer.organizationId !== organizationId) {
      throw new BadRequestException("Billing customer does not belong to this organization.");
    }
    const organizationCustomer = customer ?? (await this.billing.findCustomer(organizationId, event.provider));

    const previous = providerSubscription
      ? await this.billing.findSubscriptionByProviderId(providerSubscription.id, event.provider)
      : null;
    const result = await this.billing.processReservedEvent(
      event.id,
      event.provider,
      async (tx, storedEvent) => {
        if (storedEvent.organizationId !== organizationId) {
          throw new BadRequestException("Billing event tenant mismatch.");
        }
        if (providerSubscription) {
          if (!organizationCustomer) throw new BadRequestException("Billing customer is unknown.");
          const previousEventCreated =
            jsonNumber(previous?.metadata, "lastProviderEventCreated") ??
            jsonNumber(previous?.metadata, "lastStripeEventCreated");
          if (event.created && previousEventCreated && event.created < previousEventCreated) {
            await this.billing.auditInTransaction(tx, {
              organizationId,
              action: "billing.stale_event_ignored",
              entityType: "Subscription",
              entityId: previous?.id,
              metadata: { eventId: event.id, eventCreated: event.created, previousEventCreated },
            });
            return;
          }
          const normalized = this.normalizeSubscription(
            providerSubscription,
            event.created ?? undefined,
          );
          const subscription = await this.billing.upsertSubscription(tx, {
            organizationId,
            billingCustomerId: organizationCustomer.id,
            provider: event.provider,
            ...normalized,
          });
          const effectivePlan: PlanType = ["ACTIVE", "TRIALING"].includes(normalized.status)
            ? normalized.plan
            : "FREE";
          await this.billing.updateOrganizationPlan(tx, organizationId, effectivePlan);
          await this.billing.auditInTransaction(tx, {
            organizationId,
            action: auditAction(event.type),
            entityType: "Subscription",
            entityId: subscription.id,
            metadata: {
              provider: event.provider,
              plan: normalized.plan,
              status: normalized.status,
              eventId: event.id,
            },
          });
          if (previous && previous.plan !== normalized.plan) {
            await this.billing.auditInTransaction(tx, {
              organizationId,
              action:
                planRank(normalized.plan) > planRank(previous.plan)
                  ? "billing.plan_upgraded"
                  : "billing.plan_downgraded",
              entityType: "Subscription",
              entityId: subscription.id,
              metadata: { from: previous.plan, to: normalized.plan, eventId: event.id },
            });
          }
          if (!previous?.pausedAt && normalized.pausedAt) {
            await this.billing.auditInTransaction(tx, {
              organizationId,
              action: "billing.subscription_paused",
              entityType: "Subscription",
              entityId: subscription.id,
              metadata: { resumesAt: normalized.pauseResumesAt ?? null, eventId: event.id },
            });
          } else if (previous?.pausedAt && !normalized.pausedAt) {
            await this.billing.auditInTransaction(tx, {
              organizationId,
              action: "billing.subscription_resumed",
              entityType: "Subscription",
              entityId: subscription.id,
              metadata: { eventId: event.id },
            });
          }
          return;
        }
        await this.billing.auditInTransaction(tx, {
          organizationId,
          action: auditAction(event.type),
          entityType: "BillingEvent",
          entityId: storedEvent.id,
          metadata: { provider: event.provider, eventId: event.id },
        });
      },
    );
    await this.gates?.invalidate(organizationId);
    if (event.type === "invoice.payment_succeeded") {
      await this.analytics?.record({
        organizationId,
        eventType: "BILLING_PAYMENT",
        idempotencyKey: `billing:payment:${event.id}`,
        metadata: { revenue: (event.invoice?.amountPaidCents ?? 0) / 100 },
      });
    } else if (event.type.startsWith("customer.subscription.")) {
      await this.analytics?.record({
        organizationId,
        eventType: "SUBSCRIPTION_UPDATED",
        idempotencyKey: `billing:subscription:${event.id}`,
        metadata: {
          plan: providerSubscription
            ? this.normalizeSubscription(providerSubscription, event.created ?? undefined).plan
            : undefined,
        },
      });
    }
    return result;
  }

  async retryStoredEvent(eventId: string, provider = "STRIPE") {
    const event = await this.billing.findEvent(eventId, provider as never);
    if (!event || event.processed) return { duplicate: true };
    return this.processVerifiedEvent(
      event.payload as unknown as WebhookEvent,
      event.organizationId,
    );
  }

  async reconcileAll() {
    const candidates = await this.billing.subscriptionsForSync();
    for (const candidate of candidates) {
      const subscription = await this.payments
        .byName(candidate.provider)
        .getSubscription(candidate.providerSubscriptionId);
      const priceId = subscription.items[0]?.priceId ?? "unknown";
      const fingerprint = createHash("sha256")
        .update(
          [
            subscription.id,
            subscription.status,
            priceId,
            String(subscription.cancelAtPeriodEnd),
            String(subscription.pauseResumesAt?.toISOString() ?? ""),
          ].join(":"),
        )
        .digest("hex")
        .slice(0, 32);
      const event = {
        id: `sync_${fingerprint}`,
        type: "customer.subscription.updated",
        provider: candidate.provider,
        created: Math.floor(Date.now() / 1_000),
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        subscription,
        payload: { subscription },
      } satisfies WebhookEvent;
      await this.processVerifiedEvent(event, candidate.organizationId);
    }
    return { checked: candidates.length };
  }

  private async subscriptionForEvent(event: WebhookEvent) {
    if (event.subscription) return event.subscription;
    return event.subscriptionId
      ? this.payments.byName(event.provider).getSubscription(event.subscriptionId)
      : undefined;
  }

  private normalizeSubscription(subscription: SubscriptionResult, eventCreated?: number) {
    const configuredPrices = Object.values(this.providerPrices(subscription.provider)).filter(Boolean);
    const baseItem = subscription.items.find((item) =>
      configuredPrices
        .filter((price) => price !== this.providerPrices(subscription.provider).PHONE_NUMBER)
        .includes(item.priceId),
    );
    const priceId = baseItem?.priceId ?? subscription.priceId;
    if (!priceId) throw new BadRequestException("Billing subscription has no price.");
    const period = subscriptionPeriod(subscription, baseItem);
    return {
      providerSubscriptionId: subscription.id,
      providerPriceId: priceId,
      plan: this.planForPrice(priceId, subscription.provider, subscription.plan ?? undefined),
      status: subscription.status,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt ?? null,
      pausedAt: subscription.pausedAt ?? null,
      pauseResumesAt: subscription.pauseResumesAt ?? null,
      trialEndsAt: subscription.trialEndsAt ?? undefined,
      metadata: {
        collectionMethod: subscription.collectionMethod,
        latestInvoiceId: subscription.latestInvoiceId,
        lastProviderEventCreated: eventCreated ?? subscription.providerEventCreated ?? null,
        lastStripeEventCreated:
          subscription.provider === "STRIPE"
            ? (eventCreated ?? subscription.providerEventCreated ?? null)
            : null,
      } satisfies Prisma.InputJsonValue,
    };
  }

  private planForPrice(priceId: string, provider: string, metadataPlan?: string): PlanType {
    const prices = this.providerPrices(provider);
    const configured = Object.entries(prices).find(([, value]) => value === priceId)?.[0];
    const candidate = configured || metadataPlan;
    if (candidate === "STARTER" || candidate === "PRO" || candidate === "AGENCY") {
      return candidate;
    }
      throw new BadRequestException("Provider price is not mapped to a billing plan.");
  }

  private providerPrices(provider: string): Record<string, string> {
    return provider === "RAZORPAY"
      ? (this.config.get<Record<string, string>>("razorpay.plans") ?? {})
      : (this.config.get<Record<string, string>>("stripe.prices") ?? {});
  }
}

function planRank(plan: PlanType) {
  return { FREE: 0, STARTER: 1, PRO: 2, AGENCY: 3 }[plan];
}

function jsonNumber(value: Prisma.JsonValue | undefined, key: string) {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const candidate = value[key];
  return typeof candidate === "number" ? candidate : undefined;
}

function subscriptionPeriod(
  subscription: SubscriptionResult,
  baseItem?: SubscriptionLineItemResult,
) {
  const start = subscription.currentPeriodStart ?? baseItem?.currentPeriodStart;
  const end = subscription.currentPeriodEnd ?? baseItem?.currentPeriodEnd;
  if (!start || !end) throw new BadRequestException("Subscription period is unavailable.");
  return { start, end };
}

function auditAction(eventType: string) {
  const actions: Record<string, string> = {
    "checkout.session.completed": "billing.checkout_completed",
    "customer.subscription.created": "billing.subscription_created",
    "customer.subscription.updated": "billing.subscription_updated",
    "customer.subscription.deleted": "billing.subscription_cancelled",
    "invoice.payment_succeeded": "billing.payment_succeeded",
    "invoice.payment_failed": "billing.payment_failed",
    "refund.processed": "billing.refund_processed",
  };
  return actions[eventType] ?? "billing.event_processed";
}
