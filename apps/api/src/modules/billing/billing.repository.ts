import { Injectable } from "@nestjs/common";
import type {
  BillingProvider,
  PlanType,
  Prisma,
  SubscriptionStatus,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCustomer(organizationId: string, provider: BillingProvider = "STRIPE") {
    return this.prisma.billingCustomer.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
  }

  findCustomerByProviderId(providerCustomerId: string, provider: BillingProvider = "STRIPE") {
    return this.prisma.billingCustomer.findUnique({
      where: {
        provider_providerCustomerId: { provider, providerCustomerId },
      },
    });
  }

  upsertCustomer(input: {
    organizationId: string;
    provider?: BillingProvider;
    providerCustomerId: string;
    email: string;
  }) {
    const provider = input.provider ?? "STRIPE";
    return this.prisma.billingCustomer.upsert({
      where: {
        organizationId_provider: { organizationId: input.organizationId, provider },
      },
      update: {
        providerCustomerId: input.providerCustomerId,
        email: input.email,
        status: "ACTIVE",
      },
      create: { ...input, provider, status: "ACTIVE" },
    });
  }

  currentSubscription(organizationId: string, provider?: BillingProvider) {
    return this.prisma.subscription.findFirst({
      where: { organizationId, ...(provider ? { provider } : {}) },
      include: { billingCustomer: true },
      orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
    });
  }

  organizationBillingSettings(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        country: true,
        countryCode: true,
        currency: true,
        paymentProvider: true,
        gstNumber: true,
        billingCompanyName: true,
        billingAddress: true,
        taxRegion: true,
      },
    });
  }

  async activePhoneNumberInventory(organizationId: string) {
    const where = { organizationId, releasedAt: null, deletedAt: null };
    const [total, purchased] = await this.prisma.$transaction([
      this.prisma.phoneNumber.count({ where }),
      this.prisma.phoneNumber.count({ where: { ...where, isPurchased: true } }),
    ]);
    return { total, purchased };
  }

  upsertPhoneNumberAddon(input: {
    organizationId: string;
    subscriptionId: string;
    providerPriceId: string;
    providerSubscriptionItemId: string | null;
    quantity: number;
    unitAmountCents: number;
    currency: string;
  }) {
    return this.prisma.billingAddon.upsert({
      where: {
        organizationId_type: { organizationId: input.organizationId, type: "PHONE_NUMBER" },
      },
      create: {
        ...input,
        type: "PHONE_NUMBER",
        status: input.quantity > 0 ? "ACTIVE" : "INACTIVE",
        lastSyncedAt: new Date(),
      },
      update: {
        subscriptionId: input.subscriptionId,
        providerPriceId: input.providerPriceId,
        providerSubscriptionItemId: input.providerSubscriptionItemId,
        quantity: input.quantity,
        unitAmountCents: input.unitAmountCents,
        currency: input.currency,
        status: input.quantity > 0 ? "ACTIVE" : "INACTIVE",
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });
  }

  async markPhoneNumberAddonFailed(input: {
    organizationId: string;
    subscriptionId: string;
    providerPriceId: string;
    unitAmountCents: number;
    error: string;
  }) {
    return this.prisma.billingAddon.upsert({
      where: {
        organizationId_type: { organizationId: input.organizationId, type: "PHONE_NUMBER" },
      },
      create: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        providerPriceId: input.providerPriceId,
        unitAmountCents: input.unitAmountCents,
        type: "PHONE_NUMBER",
        status: "FAILED",
        lastError: input.error.slice(0, 500),
      },
      update: { status: "FAILED", lastError: input.error.slice(0, 500) },
    });
  }

  phoneNumberAddon(organizationId: string) {
    return this.prisma.billingAddon.findUnique({
      where: { organizationId_type: { organizationId, type: "PHONE_NUMBER" } },
    });
  }

  findSubscriptionByProviderId(
    providerSubscriptionId: string,
    provider: BillingProvider = "STRIPE",
  ) {
    return this.prisma.subscription.findUnique({
      where: {
        provider_providerSubscriptionId: {
          provider,
          providerSubscriptionId,
        },
      },
    });
  }

  async usage(organizationId: string, periodStart: Date) {
    const [agents, calls, sms, knowledgeBases, chatMessages, phoneNumbers, widgets] =
      await this.prisma.$transaction([
        this.prisma.agent.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.call.aggregate({
          where: { organizationId, startedAt: { gte: periodStart } },
          _sum: { durationSeconds: true },
        }),
        this.prisma.communicationMessage.count({
          where: {
            organizationId,
            direction: "OUTBOUND",
            createdAt: { gte: periodStart },
            status: { not: "FAILED" },
          },
        }),
        this.prisma.knowledgeBase.count({
          where: { organizationId, deletedAt: null },
        }),
        this.prisma.message.count({
          where: {
            organizationId,
            createdAt: { gte: periodStart },
            deletedAt: null,
            conversation: { channel: "WEB_CHAT" },
          },
        }),
        this.prisma.phoneNumber.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.widget.count({ where: { organizationId, deletedAt: null } }),
      ]);
    return {
      agents,
      voiceMinutes: Math.ceil((calls._sum.durationSeconds ?? 0) / 60),
      sms,
      knowledgeBases,
      chatMessages,
      phoneNumbers,
      widgets,
      campaignTargets: 0,
    };
  }

  async usageForFeature(
    organizationId: string,
    periodStart: Date,
    feature:
      | "agents"
      | "voiceMinutes"
      | "sms"
      | "chatMessages"
      | "knowledgeBases"
      | "phoneNumbers"
      | "widgets"
      | "campaignTargets",
  ) {
    switch (feature) {
      case "agents":
        return this.prisma.agent.count({ where: { organizationId, deletedAt: null } });
      case "voiceMinutes": {
        const calls = await this.prisma.call.aggregate({
          where: { organizationId, startedAt: { gte: periodStart } },
          _sum: { durationSeconds: true },
        });
        return Math.ceil((calls._sum.durationSeconds ?? 0) / 60);
      }
      case "sms":
        return this.prisma.communicationMessage.count({
          where: {
            organizationId,
            direction: "OUTBOUND",
            createdAt: { gte: periodStart },
            status: { not: "FAILED" },
          },
        });
      case "chatMessages":
        return this.prisma.message.count({
          where: {
            organizationId,
            createdAt: { gte: periodStart },
            deletedAt: null,
            conversation: { channel: "WEB_CHAT" },
          },
        });
      case "knowledgeBases":
        return this.prisma.knowledgeBase.count({ where: { organizationId, deletedAt: null } });
      case "phoneNumbers":
        return this.prisma.phoneNumber.count({ where: { organizationId, deletedAt: null } });
      case "widgets":
        return this.prisma.widget.count({ where: { organizationId, deletedAt: null } });
      case "campaignTargets":
        return this.prisma.usageEvent.aggregate({
          where: { organizationId, resourceType: "CAMPAIGN_TARGETS", createdAt: { gte: periodStart } },
          _sum: { quantity: true },
        }).then((result) => Number(result._sum.quantity ?? 0));
    }
  }

  entitlementContext(organizationId: string) {
    const now = new Date();
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        plan: true,
        status: true,
        trialStartsAt: true,
        trialEndsAt: true,
        trialStatus: true,
        subscriptions: {
          orderBy: [{ currentPeriodEnd: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            plan: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            cancelledAt: true,
            pausedAt: true,
            pauseResumesAt: true,
            pendingPlan: true,
          },
        },
        featureOverrides: {
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { feature: true, enabled: true, limit: true, expiresAt: true },
        },
      },
    });
  }

  billingPlans() {
    return this.prisma.billingPlan.findMany({
      where: { active: true },
      orderBy: [{ monthlyPriceCents: "asc" }, { version: "desc" }],
      distinct: ["plan"],
    });
  }

  async expireTrials(now = new Date()) {
    const organizations = await this.prisma.organization.findMany({
      where: { trialStatus: "ACTIVE", trialEndsAt: { lte: now } },
      select: { id: true },
    });
    for (const organization of organizations) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.organization.updateMany({
          where: { id: organization.id, trialStatus: "ACTIVE", trialEndsAt: { lte: now } },
          data: { trialStatus: "EXPIRED", status: "TRIAL_EXPIRED", plan: "FREE" },
        });
        if (!updated.count) return;
        await tx.auditEvent.create({
          data: {
            organizationId: organization.id,
            action: "billing.trial_expired",
            entityType: "Organization",
            entityId: organization.id,
          },
        });
      });
    }
    return organizations.map(({ id }) => id);
  }

  duePausedSubscriptions(now = new Date()) {
    return this.prisma.subscription.findMany({
      where: { pausedAt: { not: null }, pauseResumesAt: { lte: now } },
      select: { id: true, organizationId: true, provider: true, providerSubscriptionId: true },
    });
  }

  subscriptionsForSync(take = 100) {
    return this.prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "UNPAID", "INCOMPLETE"] } },
      orderBy: { updatedAt: "asc" },
      take,
      select: { organizationId: true, provider: true, providerSubscriptionId: true },
    });
  }

  organizationsForCacheRefresh(take = 500) {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true },
    });
  }

  updatePendingPlan(id: string, pendingPlan: Exclude<PlanType, "FREE"> | null) {
    return this.prisma.subscription.update({ where: { id }, data: { pendingPlan } });
  }

  updatePauseRequest(id: string, pausedAt: Date | null, pauseResumesAt: Date | null) {
    return this.prisma.subscription.update({
      where: { id },
      data: { pausedAt, pauseResumesAt },
    });
  }

  createAudit(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }

  reserveEvent(input: {
    organizationId: string;
    provider?: BillingProvider;
    eventId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }) {
    const provider = input.provider ?? "STRIPE";
    return this.prisma.billingEvent.upsert({
      where: { provider_eventId: { provider, eventId: input.eventId } },
      update: {},
      create: { ...input, provider, processed: false },
    });
  }

  findEvent(eventId: string, provider: BillingProvider = "STRIPE") {
    return this.prisma.billingEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
  }

  async processReservedEvent(
    eventId: string,
    provider: BillingProvider,
    handler: (
      tx: Prisma.TransactionClient,
      event: { id: string; organizationId: string; processed: boolean },
    ) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${provider.toLowerCase()}:${eventId}`}))`;
      const event = await tx.billingEvent.findUnique({
        where: { provider_eventId: { provider, eventId } },
        select: { id: true, organizationId: true, processed: true },
      });
      if (!event) throw new Error("Reserved billing event was not found.");
      if (event.processed) return { duplicate: true };
      await handler(tx, event);
      await tx.billingEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });
      return { duplicate: false };
    });
  }

  upsertSubscription(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      billingCustomerId: string;
      provider?: BillingProvider;
      providerSubscriptionId: string;
      providerPriceId: string;
      plan: PlanType;
      status: SubscriptionStatus;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      cancelAtPeriodEnd: boolean;
      cancelledAt?: Date | null;
      pausedAt?: Date | null;
      pauseResumesAt?: Date | null;
      trialEndsAt?: Date;
      metadata: Prisma.InputJsonValue;
    },
  ) {
    const provider = input.provider ?? "STRIPE";
    return tx.subscription.upsert({
      where: {
        provider_providerSubscriptionId: {
          provider,
          providerSubscriptionId: input.providerSubscriptionId,
        },
      },
      update: { ...input, pendingPlan: null },
      create: { ...input, provider },
    });
  }

  updateOrganizationPlan(tx: Prisma.TransactionClient, organizationId: string, plan: PlanType) {
    return tx.organization.update({
      where: { id: organizationId },
      data: {
        plan,
        status: plan === "FREE" ? undefined : "ACTIVE",
        trialStatus: plan === "FREE" ? undefined : "CONVERTED",
      },
    });
  }

  auditInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      action: string;
      entityType: string;
      entityId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditEvent.create({ data: input });
  }
}
