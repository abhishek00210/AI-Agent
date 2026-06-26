import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { SubscriptionService } from "./subscription.service";
import { BillingRepository } from "./billing.repository";
import { FeatureGateService, PLAN_LIMITS } from "./feature-gate.service";
import { Optional } from "@nestjs/common";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { PaymentProviderFactory } from "../payments/payment-provider.factory";

export type BillingJobName =
  | "RetryFailedWebhooks"
  | "SubscriptionSync"
  | "InvoiceSync"
  | "TrialExpirationCheck"
  | "ExpiredSubscriptionCheck"
  | "PauseResumeCheck"
  | "PhoneNumberAddonSync"
  | "PhoneNumberAddonReconcile"
  | "BillingCacheRefresh";
export interface BillingJobData {
  eventId?: string;
  provider?: string;
  organizationId?: string;
}

@Injectable()
export class BillingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingQueueService.name);
  private queue?: Queue<BillingJobData, void, BillingJobName>;
  private worker?: Worker<BillingJobData, void, BillingJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionService,
    private readonly billing: BillingRepository,
    private readonly gates: FeatureGateService,
    private readonly payments: PaymentProviderFactory,
    @Optional() private readonly metrics?: RealtimeMetricsService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) return;
    const connection = { url: redisUrl, maxRetriesPerRequest: null };
    this.queue = new Queue("stripe-billing", {
      connection,
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 1_000 },
      },
    });
    this.worker = new Worker(
      "stripe-billing",
      async (job: Job<BillingJobData, void, BillingJobName>) => {
        if (job.name === "SubscriptionSync" && !job.data.eventId) {
          await this.subscriptions.reconcileAll();
          return;
        }
        if (["RetryFailedWebhooks", "SubscriptionSync", "InvoiceSync"].includes(job.name)) {
          if (job.data.eventId) {
            await this.subscriptions.retryStoredEvent(job.data.eventId, job.data.provider);
          }
          return;
        }
        if (job.name === "TrialExpirationCheck" || job.name === "ExpiredSubscriptionCheck") {
          const expired = await this.billing.expireTrials();
          this.metrics?.increment("billing_trials_expired", expired.length);
          await Promise.all(expired.map((organizationId) => this.gates.invalidate(organizationId)));
          return;
        }
        if (job.name === "PauseResumeCheck") {
          const due = await this.billing.duePausedSubscriptions();
          for (const subscription of due) {
            await this.payments
              .byName(subscription.provider)
              .resumeSubscription(subscription.providerSubscriptionId);
          }
          return;
        }
        if (job.name === "BillingCacheRefresh") {
          const organizations = await this.billing.organizationsForCacheRefresh();
          await Promise.all(organizations.map(({ id }) => this.gates.invalidate(id)));
          return;
        }
        if (job.name === "PhoneNumberAddonSync") {
          if (job.data.organizationId) await this.syncPhoneNumberAddon(job.data.organizationId);
          return;
        }
        if (job.name === "PhoneNumberAddonReconcile") {
          const subscriptions = await this.billing.subscriptionsForSync();
          for (const subscription of subscriptions) {
            await this.syncPhoneNumberAddon(subscription.organizationId);
          }
        }
      },
      { connection, concurrency: 5 },
    );
    this.worker.on("failed", (job, error) => {
      this.metrics?.increment("billing_job_failures");
      this.logger.warn(`Billing job ${job?.id ?? "unknown"} failed: ${error.message}`);
    });
    void this.registerSchedulers();
  }

  async enqueue(name: BillingJobName, eventId?: string, delay = 0, provider = "STRIPE") {
    if (!this.queue) return;
    await this.queue.add(name, { eventId, provider }, { delay, jobId: `${name}-${provider}-${eventId}` });
  }

  async enqueuePhoneNumberSync(organizationId: string) {
    if (!this.queue) {
      await this.syncPhoneNumberAddon(organizationId);
      return;
    }
    await this.queue.add(
      "PhoneNumberAddonSync",
      { organizationId },
      {
        jobId: `PhoneNumberAddonSync-${organizationId}-${Date.now()}`,
        attempts: 8,
        backoff: { type: "exponential", delay: 5_000 },
      },
    );
  }

  async syncPhoneNumberAddon(organizationId: string) {
    const subscription = await this.billing.currentSubscription(organizationId);
    if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status)) return;
    const priceId = this.phoneNumberPriceId(subscription.provider);
    const included = PLAN_LIMITS[subscription.plan].phoneNumbers;
    const inventory = await this.billing.activePhoneNumberInventory(organizationId);
    const quantity =
      included === null
        ? 0
        : Math.min(inventory.purchased, Math.max(0, inventory.total - included));
    if (!priceId) {
      if (quantity > 0) throw new Error("Stripe phone-number add-on price is not configured.");
      return;
    }
    const unitAmountCents = 499;
    try {
      const result = await this.payments.byName(subscription.provider).syncSubscriptionAddon({
        subscriptionId: subscription.providerSubscriptionId,
        priceId,
        quantity,
      });
      await this.billing.upsertPhoneNumberAddon({
        organizationId,
        subscriptionId: subscription.id,
        providerPriceId: priceId,
        providerSubscriptionItemId: result.subscriptionItemId,
        quantity,
        unitAmountCents: result.unitAmountCents,
        currency: result.currency,
      });
      await this.billing.createAudit({
        organizationId,
        action: "billing.phone_number_addon_synced",
        entityType: "BillingAddon",
        metadata: {
          totalOwned: inventory.total,
          providerPurchased: inventory.purchased,
          included,
          billableQuantity: quantity,
          unitAmountCents: result.unitAmountCents,
          currency: result.currency,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown billing add-on error";
      await this.billing.markPhoneNumberAddonFailed({
        organizationId,
        subscriptionId: subscription.id,
        providerPriceId: priceId,
        unitAmountCents,
        error: message,
      });
      throw error;
    }
  }

  private async registerSchedulers() {
    if (!this.queue) return;
    await Promise.all([
      this.queue.upsertJobScheduler(
        "TrialExpirationCheck",
        { pattern: "0 2 * * *" },
        { name: "TrialExpirationCheck", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "ExpiredSubscriptionCheck",
        { every: 60 * 60 * 1_000 },
        { name: "ExpiredSubscriptionCheck", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "PauseResumeCheck",
        { every: 5 * 60 * 1_000 },
        { name: "PauseResumeCheck", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "SubscriptionSync",
        { every: 60 * 60 * 1_000 },
        { name: "SubscriptionSync", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "BillingCacheRefresh",
        { every: 15 * 60 * 1_000 },
        { name: "BillingCacheRefresh", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "PhoneNumberAddonReconcile",
        { every: 60 * 60 * 1_000 },
        { name: "PhoneNumberAddonReconcile", data: {} },
      ),
    ]).catch((error) => {
      this.logger.warn(
        `Billing schedulers unavailable: ${error instanceof Error ? error.message : "unknown"}`,
      );
    });
  }

  private phoneNumberPriceId(provider = "STRIPE") {
    const prefix = provider === "RAZORPAY" ? "razorpay.plans" : "stripe.prices";
    return this.config.get<string>(`${prefix}.PHONE_NUMBER`)?.trim() || "";
  }

  async depth() {
    if (!this.queue) return { available: false, waiting: 0, delayed: 0, failed: 0 };
    const [waiting, delayed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);
    return { available: true, waiting, delayed, failed };
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
