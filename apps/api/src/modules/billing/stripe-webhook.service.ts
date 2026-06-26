import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import { BillingQueueService } from "./billing-queue.service";
import { BillingRepository } from "./billing.repository";
import { SubscriptionService } from "./subscription.service";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { PaymentProviderFactory } from "../payments/payment-provider.factory";
import type { WebhookEvent } from "../payments/providers/payment-provider.interface";

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly counters = { received: 0, processed: 0, duplicate: 0, failed: 0 };

  constructor(
    private readonly payments: PaymentProviderFactory,
    private readonly billing: BillingRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly queue: BillingQueueService,
    @Optional() private readonly metricsService?: RealtimeMetricsService,
  ) {}

  async handle(payload: Buffer, signature?: string) {
    return this.handleProvider("STRIPE", payload, signature);
  }

  async handleRazorpay(payload: Buffer, signature?: string) {
    return this.handleProvider("RAZORPAY", payload, signature);
  }

  private async handleProvider(provider: "STRIPE" | "RAZORPAY", payload: Buffer, signature?: string) {
    this.counters.received += 1;
    this.metricsService?.increment("billing_webhooks_received");
    if (!signature) throw new ForbiddenException(`${provider} signature is required.`);
    let event: WebhookEvent;
    try {
      event = this.payments.byName(provider).verifyWebhook(payload, signature);
    } catch {
      this.counters.failed += 1;
      throw new ForbiddenException(`Invalid ${provider} signature.`);
    }
    if (!this.subscriptions.supports(event.type)) {
      return { received: true, ignored: true };
    }
    const organizationId = await this.resolveOrganization(event);
    try {
      const result = await this.subscriptions.processVerifiedEvent(event, organizationId);
      if (result.duplicate) this.counters.duplicate += 1;
      else this.counters.processed += 1;
      this.metricsService?.increment(
        result.duplicate ? "billing_webhooks_duplicate" : "billing_webhooks_processed",
      );
      return { received: true, duplicate: result.duplicate };
    } catch (error) {
      this.counters.failed += 1;
      this.metricsService?.increment("billing_webhooks_failed");
      await this.queue
        .enqueue("RetryFailedWebhooks", event.id, 5_000, event.provider)
        .catch(() => undefined);
      this.logger.warn(`Verified ${provider} ${event.type} event could not be processed.`);
      throw error;
    }
  }

  metrics() {
    return { ...this.counters };
  }

  private async resolveOrganization(event: WebhookEvent) {
    if (event.customerId) {
      const customer = await this.billing.findCustomerByProviderId(event.customerId, event.provider);
      if (customer) return customer.organizationId;
    }
    if (event.subscriptionId) {
      const subscription = await this.billing.findSubscriptionByProviderId(
        event.subscriptionId,
        event.provider,
      );
      if (subscription) return subscription.organizationId;
    }
    const organizationId = organizationIdFromPayload(event.payload);
    if (organizationId) return organizationId;
    throw new BadRequestException(`${event.provider} event is not linked to a billing tenant.`);
  }
}

function organizationIdFromPayload(payload: Record<string, unknown>) {
  const direct = stringAt(payload, "organizationId");
  if (direct) return direct;
  const subscriptionNotes = nestedNotes(payload, "subscription");
  const paymentNotes = nestedNotes(payload, "payment");
  const invoiceNotes = nestedNotes(payload, "invoice");
  return (
    stringAt(subscriptionNotes, "organizationId") ??
    stringAt(paymentNotes, "organizationId") ??
    stringAt(invoiceNotes, "organizationId") ??
    null
  );
}

function nestedNotes(payload: Record<string, unknown>, key: string): Record<string, unknown> {
  const wrapper = payload.payload;
  if (!wrapper || typeof wrapper !== "object" || Array.isArray(wrapper)) return {};
  const object = (wrapper as Record<string, unknown>)[key];
  if (!object || typeof object !== "object" || Array.isArray(object)) return {};
  const entity = (object as Record<string, unknown>).entity;
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) return {};
  const notes = (entity as Record<string, unknown>).notes;
  return notes && typeof notes === "object" && !Array.isArray(notes)
    ? (notes as Record<string, unknown>)
    : {};
}

function stringAt(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
