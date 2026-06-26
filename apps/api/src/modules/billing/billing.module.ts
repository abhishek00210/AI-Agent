import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { BillingQueueService } from "./billing-queue.service";
import { BillingRepository } from "./billing.repository";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { FeatureGateService } from "./feature-gate.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { RazorpayWebhookController } from "./razorpay-webhook.controller";
import { StripeWebhookService } from "./stripe-webhook.service";
import { SubscriptionService } from "./subscription.service";
import { UsageModule } from "../usage/usage.module";
import { UsageController } from "../usage/usage.controller";
import { PaymentModule } from "../payments/payment.module";

@Module({
  imports: [AuthModule, TenantModule, UsageModule, PaymentModule],
  controllers: [BillingController, StripeWebhookController, RazorpayWebhookController, UsageController],
  providers: [
    BillingRepository,
    SubscriptionService,
    BillingQueueService,
    StripeWebhookService,
    FeatureGateService,
    BillingService,
  ],
  exports: [BillingService, FeatureGateService],
})
export class BillingModule {}
