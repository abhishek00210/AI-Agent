import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { PlanType } from "../../../generated/prisma";
import { RedisService } from "../../redis/redis.service";
import { BillingRepository } from "./billing.repository";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { UsageService } from "../usage/usage.service";
import type { UsageResource } from "../../../generated/prisma";

export type BillableFeature =
  | "agents"
  | "voiceMinutes"
  | "sms"
  | "chatMessages"
  | "knowledgeBases"
  | "phoneNumbers"
  | "widgets"
  | "campaignTargets";
export type Capability =
  | "googleCalendar"
  | "appointments"
  | "crm"
  | "websiteWidget"
  | "apiAccess"
  | "prioritySupport"
  | "advancedAnalytics"
  | "realtimeVoice";
export type PlanLimits = Record<BillableFeature, number | null>;
export type PlanCapabilities = Record<Capability, boolean>;

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    agents: 1,
    voiceMinutes: 50,
    sms: 20,
    chatMessages: null,
    knowledgeBases: 1,
    phoneNumbers: null,
    widgets: null,
    campaignTargets: 0,
  },
  STARTER: {
    agents: 1,
    voiceMinutes: 500,
    sms: 500,
    chatMessages: 5_000,
    knowledgeBases: 10,
    phoneNumbers: 1,
    widgets: 1,
    campaignTargets: 100,
  },
  PRO: {
    agents: 5,
    voiceMinutes: 2_500,
    sms: 2_500,
    chatMessages: 25_000,
    knowledgeBases: 50,
    phoneNumbers: 10,
    widgets: 1,
    campaignTargets: 1_000,
  },
  AGENCY: {
    agents: null,
    voiceMinutes: 10_000,
    sms: 10_000,
    chatMessages: null,
    knowledgeBases: null,
    phoneNumbers: null,
    widgets: null,
    campaignTargets: 10_000,
  },
};

export const PLAN_CAPABILITIES: Record<PlanType, PlanCapabilities> = {
  FREE: {
    googleCalendar: true,
    appointments: true,
    crm: true,
    websiteWidget: true,
    apiAccess: false,
    prioritySupport: false,
    advancedAnalytics: true,
    realtimeVoice: true,
  },
  STARTER: {
    googleCalendar: true,
    appointments: true,
    crm: true,
    websiteWidget: true,
    apiAccess: false,
    prioritySupport: false,
    advancedAnalytics: false,
    realtimeVoice: true,
  },
  PRO: {
    googleCalendar: true,
    appointments: true,
    crm: true,
    websiteWidget: true,
    apiAccess: true,
    prioritySupport: true,
    advancedAnalytics: true,
    realtimeVoice: true,
  },
  AGENCY: {
    googleCalendar: true,
    appointments: true,
    crm: true,
    websiteWidget: true,
    apiAccess: true,
    prioritySupport: true,
    advancedAnalytics: true,
    realtimeVoice: true,
  },
};

export interface ResolvedEntitlements {
  organizationId: string;
  plan: PlanType;
  source: "SUBSCRIPTION" | "TRIAL" | "LEGACY_FREE" | "BLOCKED";
  state: string;
  allowed: boolean;
  reason: string | null;
  periodStart: string;
  periodEnd: string;
  trialEndsAt: string | null;
  pausedUntil: string | null;
  limits: PlanLimits;
  capabilities: PlanCapabilities;
}

const CACHE_TTL_SECONDS = 60;
const TRIAL_EXPIRED_MESSAGE = "Your trial has expired. Upgrade to continue.";

@Injectable()
export class FeatureGateService {
  private readonly logger = new Logger(FeatureGateService.name);

  constructor(
    private readonly billing: BillingRepository,
    @Optional() private readonly usageService?: UsageService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly metrics?: RealtimeMetricsService,
  ) {}

  limits(plan: PlanType) {
    return PLAN_LIMITS[plan];
  }

  async resolve(organizationId: string): Promise<ResolvedEntitlements> {
    const cached = await this.readCache(organizationId);
    if (cached) return cached;
    const context = await this.billing.entitlementContext(organizationId);
    if (!context) throw new NotFoundException("Organization not found.");

    const now = new Date();
    const subscription = context.subscriptions[0];
    const trialActive =
      context.trialStatus === "ACTIVE" && Boolean(context.trialEndsAt && context.trialEndsAt > now);
    const suspended = context.status === "SUSPENDED" || context.status === "ARCHIVED";
    const paidActive = subscription && ["ACTIVE", "TRIALING"].includes(subscription.status);
    const paused = Boolean(
      paidActive &&
      subscription.pausedAt &&
      (!subscription.pauseResumesAt || subscription.pauseResumesAt > now),
    );

    let plan: PlanType = "FREE";
    let source: ResolvedEntitlements["source"] = "BLOCKED";
    let state: string = context.status;
    let allowed = false;
    let reason: string | null = "Subscription required.";
    let periodStart = startOfMonth(now);
    let periodEnd = endOfMonth(now);

    if (paidActive) {
      plan = subscription.plan;
      source = "SUBSCRIPTION";
      state = paused ? "PAUSED" : subscription.status;
      allowed = !paused;
      reason = paused ? "Your subscription is paused. Resume it to continue." : null;
      periodStart = subscription.currentPeriodStart;
      periodEnd = subscription.currentPeriodEnd;
    } else if (subscription && ["PAST_DUE", "UNPAID", "INCOMPLETE"].includes(subscription.status)) {
      plan = subscription.plan;
      source = "BLOCKED";
      state = subscription.status;
      reason = "Payment is required to continue.";
      periodStart = subscription.currentPeriodStart;
      periodEnd = subscription.currentPeriodEnd;
    } else if (trialActive) {
      plan = "STARTER";
      source = "TRIAL";
      state = "TRIAL";
      allowed = true;
      reason = null;
      periodStart = context.trialStartsAt ?? now;
      periodEnd = context.trialEndsAt ?? endOfMonth(now);
    } else if (context.trialStatus === null && context.status === "ACTIVE") {
      plan = context.plan;
      source = "LEGACY_FREE";
      state = "ACTIVE";
      allowed = true;
      reason = null;
    } else if (
      context.trialStatus === "EXPIRED" ||
      context.status === "TRIAL_EXPIRED" ||
      (context.trialStatus === "ACTIVE" &&
        Boolean(context.trialEndsAt && context.trialEndsAt <= now))
    ) {
      state = "TRIAL_EXPIRED";
      reason = TRIAL_EXPIRED_MESSAGE;
    }

    if (suspended) {
      source = "BLOCKED";
      state = context.status;
      allowed = false;
      reason = "Organization access is disabled.";
    }

    const limits = { ...PLAN_LIMITS[plan] };
    const capabilities = { ...PLAN_CAPABILITIES[plan] };
    for (const override of context.featureOverrides) {
      if (override.feature in limits && override.limit !== null) {
        limits[override.feature as BillableFeature] = override.limit;
      }
      if (override.feature in capabilities && override.enabled !== null) {
        capabilities[override.feature as Capability] = override.enabled;
      }
    }

    const resolved: ResolvedEntitlements = {
      organizationId,
      plan,
      source,
      state,
      allowed,
      reason,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      trialEndsAt: context.trialEndsAt?.toISOString() ?? null,
      pausedUntil: subscription?.pauseResumesAt?.toISOString() ?? null,
      limits,
      capabilities,
    };
    await this.writeCache(resolved);
    return resolved;
  }

  async usage(organizationId: string, plan?: PlanType, periodStart?: Date) {
    const resolved = plan && periodStart ? null : await this.resolve(organizationId);
    const effectivePlan = plan ?? resolved!.plan;
    const start = periodStart ?? new Date(resolved!.periodStart);
    const counters = this.usageService
      ? await this.usageService.getUsage(organizationId, {
          start,
          end: new Date(resolved?.periodEnd ?? endOfMonth(start)),
          source:
            resolved?.source === "SUBSCRIPTION"
              ? "SUBSCRIPTION"
              : resolved?.source === "TRIAL"
                ? "TRIAL"
                : "CALENDAR",
        })
      : null;
    const used = counters
      ? {
          agents: counters.values.AGENTS,
          voiceMinutes: counters.values.AI_MINUTES,
          sms: counters.values.SMS_MESSAGES,
          chatMessages: counters.values.MESSAGES,
          knowledgeBases: counters.values.KNOWLEDGE_BASES,
          phoneNumbers: counters.values.PHONE_NUMBERS,
          widgets: counters.values.WIDGETS,
          campaignTargets: counters.values.CAMPAIGN_TARGETS,
        }
      : await this.billing.usage(organizationId, start);
    const limits = resolved?.limits ?? PLAN_LIMITS[effectivePlan];
    return Object.fromEntries(
      Object.entries(used).map(([feature, value]) => [
        feature,
        { used: value, limit: limits[feature as BillableFeature] },
      ]),
    ) as Record<BillableFeature, { used: number; limit: number | null }>;
  }

  async assertAvailable(
    organizationId: string,
    feature: BillableFeature,
    amount?: number,
  ): Promise<void>;
  async assertAvailable(
    organizationId: string,
    plan: PlanType,
    feature: BillableFeature,
    periodStart: Date,
    amount?: number,
  ): Promise<void>;
  async assertAvailable(
    organizationId: string,
    planOrFeature: PlanType | BillableFeature,
    featureOrAmount?: BillableFeature | number,
    periodStart?: Date,
    legacyAmount = 1,
  ) {
    const legacy = typeof featureOrAmount === "string";
    const feature = (legacy ? featureOrAmount : planOrFeature) as BillableFeature;
    const amount = legacy ? legacyAmount : ((featureOrAmount as number | undefined) ?? 1);
    const resolved = legacy
      ? ({
          plan: planOrFeature as PlanType,
          allowed: true,
          reason: null,
          periodStart: (periodStart ?? new Date()).toISOString(),
          limits: PLAN_LIMITS[planOrFeature as PlanType],
        } as ResolvedEntitlements)
      : await this.resolve(organizationId);
    this.assertExecutionAllowed(resolved);
    const limit = resolved.limits[feature];
    if (limit === null) return;
    const counters = this.usageService
      ? await this.usageService.getUsage(organizationId, {
          start: new Date(resolved.periodStart),
          end: new Date(resolved.periodEnd),
          source:
            resolved.source === "SUBSCRIPTION"
              ? "SUBSCRIPTION"
              : resolved.source === "TRIAL"
                ? "TRIAL"
                : "CALENDAR",
        })
      : null;
    const usage = counters
      ? counters.values[usageResource(feature)]
      : await this.billing.usageForFeature(organizationId, new Date(resolved.periodStart), feature);
    if (usage + amount > limit) {
      throw new ForbiddenException(`${feature} usage limit reached for the ${resolved.plan} plan.`);
    }
  }

  async canCreateAgent(organizationId: string) {
    return this.canUse(organizationId, () => this.assertAvailable(organizationId, "agents"));
  }
  async canReceiveCalls(organizationId: string) {
    return this.canUse(organizationId, () => this.assertAvailable(organizationId, "voiceMinutes"));
  }
  async canSendSMS(organizationId: string) {
    return this.canUse(organizationId, () => this.assertAvailable(organizationId, "sms"));
  }
  async canCreateKnowledgeBase(organizationId: string) {
    return this.canUse(organizationId, () =>
      this.assertAvailable(organizationId, "knowledgeBases"),
    );
  }
  async canCreateWidget(organizationId: string) {
    return this.canUse(organizationId, async () => {
      await this.assertCapability(organizationId, "websiteWidget");
      await this.assertAvailable(organizationId, "widgets");
    });
  }
  async canCreateAppointment(organizationId: string) {
    return this.canUse(organizationId, () => this.assertCapability(organizationId, "appointments"));
  }
  async canUseRealtimeVoice(organizationId: string) {
    return this.canUse(organizationId, () =>
      this.assertCapability(organizationId, "realtimeVoice"),
    );
  }
  async canUseApi(organizationId: string) {
    return this.canUse(organizationId, () => this.assertCapability(organizationId, "apiAccess"));
  }
  async assertChatCapacity(organizationId: string, amount = 1) {
    await this.assertCapability(organizationId, "websiteWidget");
    await this.assertAvailable(organizationId, "chatMessages", amount);
  }

  async assertCampaignTargetCapacity(organizationId: string, amount: number) {
    await this.assertAvailable(organizationId, "campaignTargets", amount);
  }

  async assertAppointmentCapacity(organizationId: string) {
    await this.assertCapability(organizationId, "appointments");
  }

  async assertKnowledgeStorageCapacity(organizationId: string, amountMb: number) {
    const resolved = await this.resolve(organizationId);
    this.assertExecutionAllowed(resolved);
    const context = await this.billing.entitlementContext(organizationId);
    const storageOverride = context?.featureOverrides.find(
      (override) => override.feature === "knowledgeStorageMb",
    );
    if (storageOverride?.limit == null) return;
    if (!this.usageService) return;
    const usage = await this.usageService.getUsage(organizationId);
    if (usage.values.KNOWLEDGE_STORAGE_MB + amountMb > storageOverride.limit) {
      throw new ForbiddenException("Knowledge storage limit reached for this organization.");
    }
  }

  async assertCapability(organizationId: string, capability: Capability) {
    const resolved = await this.resolve(organizationId);
    this.assertExecutionAllowed(resolved);
    if (!resolved.capabilities[capability]) {
      throw new ForbiddenException(`${capability} is not included in the ${resolved.plan} plan.`);
    }
  }

  async invalidate(organizationId: string) {
    if (!this.redis?.isAvailable) return;
    try {
      await this.redis.cache.del(this.cacheKey(organizationId));
    } catch (error) {
      this.logger.warn(`Billing cache invalidation failed: ${safeError(error)}`);
    }
  }

  private assertExecutionAllowed(resolved: Pick<ResolvedEntitlements, "allowed" | "reason">) {
    if (!resolved.allowed) {
      this.metrics?.increment("billing_entitlement_denied");
      throw new ForbiddenException(resolved.reason ?? "Upgrade to continue.");
    }
  }

  private async canUse(organizationId: string, assertion: () => Promise<void>) {
    try {
      await assertion();
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  }

  private cacheKey(organizationId: string) {
    return `billing:entitlements:v1:${organizationId}`;
  }

  private async readCache(organizationId: string) {
    if (!this.redis?.isAvailable) return null;
    try {
      const value = await this.redis.cache.get(this.cacheKey(organizationId));
      this.metrics?.increment(value ? "billing_cache_hits" : "billing_cache_misses");
      return value ? (JSON.parse(value) as ResolvedEntitlements) : null;
    } catch (error) {
      this.logger.warn(`Billing cache read failed: ${safeError(error)}`);
      return null;
    }
  }

  private async writeCache(value: ResolvedEntitlements) {
    if (!this.redis?.isAvailable) return;
    try {
      await this.redis.cache.setex(
        this.cacheKey(value.organizationId),
        CACHE_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch (error) {
      this.logger.warn(`Billing cache write failed: ${safeError(error)}`);
    }
  }
}

function usageResource(feature: BillableFeature): UsageResource {
  return {
    agents: "AGENTS",
    voiceMinutes: "AI_MINUTES",
    sms: "SMS_MESSAGES",
    chatMessages: "MESSAGES",
    knowledgeBases: "KNOWLEDGE_BASES",
    phoneNumbers: "PHONE_NUMBERS",
    widgets: "WIDGETS",
    campaignTargets: "CAMPAIGN_TARGETS",
  }[feature] as UsageResource;
}

function startOfMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function endOfMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}
