import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { CommunicationThreadService } from "./communication-thread.service";
import { CommunicationThreadRepository } from "./repositories/communication-thread.repository";
import { TelephonyModule } from "../telephony/telephony.module";
import { CommunicationController } from "./communication.controller";
import { CommunicationWebhookController } from "./communication-webhook.controller";
import { CommunicationService } from "./communication.service";
import { DeliveryWebhookService } from "./delivery-webhook.service";
import { MessageDeliveryService } from "./message-delivery.service";
import { MessageRepository } from "./repositories/message.repository";
import { RetryService } from "./retry.service";
import { SMS_PROVIDER } from "./sms-provider";
import { SmsQueueService } from "./sms-queue.service";
import { TwilioSMSProvider } from "./twilio-sms.provider";
import { BillingModule } from "../billing/billing.module";
import { CustomerModule } from "../customer/customer.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { AutomationModule } from "../automation/automation.module";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    TelephonyModule,
    BillingModule,
    CustomerModule,
    CustomerTimelineModule,
    forwardRef(() => AutomationModule),
  ],
  controllers: [CommunicationController, CommunicationWebhookController],
  providers: [
    CommunicationThreadRepository,
    CommunicationThreadService,
    MessageRepository,
    TwilioSMSProvider,
    { provide: SMS_PROVIDER, useExisting: TwilioSMSProvider },
    MessageDeliveryService,
    SmsQueueService,
    RetryService,
    DeliveryWebhookService,
    CommunicationService,
  ],
  exports: [CommunicationThreadService, CommunicationService, SmsQueueService],
})
export class CommunicationModule {}
