import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { CustomerModule } from "../customer/customer.module";
import { TenantModule } from "../tenant/tenant.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { UsageModule } from "../usage/usage.module";
import { VoiceWebhookUrlService } from "../voice/voice-webhook-url.service";
import { OutboundCallController } from "./outbound-call.controller";
import { OutboundCallProvider } from "./outbound-call.provider";
import { OutboundCallService } from "./outbound-call.service";
import { TwilioOutboundCallProvider } from "./twilio-outbound-call.provider";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    TelephonyModule,
    CustomerModule,
    CustomerTimelineModule,
    UsageModule,
    AnalyticsModule,
  ],
  controllers: [OutboundCallController],
  providers: [
    OutboundCallService,
    VoiceWebhookUrlService,
    TwilioOutboundCallProvider,
    { provide: OutboundCallProvider, useExisting: TwilioOutboundCallProvider },
  ],
  exports: [OutboundCallService],
})
export class OutboundCallModule {}
