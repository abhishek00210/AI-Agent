import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { MediaStreamModule } from "../media-stream/media-stream.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { RecordingModule } from "../recording/recording.module";
import { TranscriptionModule } from "../transcription/transcription.module";
import { TwilioModule } from "../twilio/twilio.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { CallController } from "./call.controller";
import { CallRoutingService } from "./call-routing.service";
import { CallAnalyticsService } from "./call-analytics.service";
import { CallExportService } from "./call-export.service";
import { CallLogService } from "./call-log.service";
import { CallSearchService } from "./call-search.service";
import { CallService } from "./call.service";
import { PhoneNumberController } from "./phone-number.controller";
import { PhoneNumberService } from "./phone-number.service";
import { CallRepository } from "./repositories/call.repository";
import { PhoneNumberRepository } from "./repositories/phone-number.repository";
import { IncomingCallController } from "./incoming-call.controller";
import { IncomingCallService } from "./incoming-call.service";
import { TwiMLResponseService } from "./twiml-response.service";
import { TwilioWebhookGuard } from "./twilio-webhook.guard";
import { ExotelWebhookGuard } from "./exotel-webhook.guard";
import { VoiceWebhookUrlService } from "./voice-webhook-url.service";
import { VoiceController } from "./voice.controller";
import { VoiceService } from "./voice.service";
import { BillingModule } from "../billing/billing.module";
import { UsageModule } from "../usage/usage.module";
import { PhoneNumberMarketplaceController } from "./phone-number-marketplace.controller";
import { PhoneNumberMarketplaceService } from "./phone-number-marketplace.service";
import { ExternalNumberModule } from "../external-number/external-number.module";
import { CustomerModule } from "../customer/customer.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { AutomationModule } from "../automation/automation.module";
import { ExotelIncomingCallController } from "./exotel-incoming-call.controller";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    TwilioModule,
    TelephonyModule,
    MediaStreamModule,
    RealtimeModule,
    RecordingModule,
    TranscriptionModule,
    BillingModule,
    UsageModule,
    ExternalNumberModule,
    CustomerModule,
    CustomerTimelineModule,
    AutomationModule,
  ],
  controllers: [
    VoiceController,
    PhoneNumberController,
    PhoneNumberMarketplaceController,
    CallController,
    IncomingCallController,
    ExotelIncomingCallController,
  ],
  providers: [
    VoiceService,
    PhoneNumberService,
    PhoneNumberMarketplaceService,
    PhoneNumberRepository,
    CallAnalyticsService,
    CallExportService,
    CallLogService,
    CallSearchService,
    CallService,
    CallRepository,
    CallRoutingService,
    IncomingCallService,
    TwiMLResponseService,
    TwilioWebhookGuard,
    ExotelWebhookGuard,
    VoiceWebhookUrlService,
  ],
  exports: [VoiceService, PhoneNumberService, CallService, CallLogService],
})
export class VoiceModule {}
