import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { TenantModule } from "../tenant/tenant.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { UsageModule } from "../usage/usage.module";
import { VoiceWebhookUrlService } from "../voice/voice-webhook-url.service";
import { PortEncryptionService } from "./port-encryption.service";
import { PortRequestController } from "./port-request.controller";
import { PortRequestService } from "./port-request.service";
import { TwilioPortingService } from "./twilio-porting.service";

@Module({
  imports: [AuthModule, TenantModule, StorageModule, TelephonyModule, UsageModule],
  controllers: [PortRequestController],
  providers: [
    PortRequestService,
    PortEncryptionService,
    TwilioPortingService,
    VoiceWebhookUrlService,
  ],
  exports: [PortRequestService],
})
export class PortRequestModule {}
