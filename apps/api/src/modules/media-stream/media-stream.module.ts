import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RecordingModule } from "../recording/recording.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TenantModule } from "../tenant/tenant.module";
import { TwilioModule } from "../twilio/twilio.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { AudioPacketService } from "./audio-packet.service";
import { CallSessionController } from "./call-session.controller";
import { CallSessionService } from "./call-session.service";
import { MediaStreamGateway } from "./media-stream.gateway";
import { MediaStreamService } from "./media-stream.service";
import { CallSessionRepository } from "./repositories/call-session.repository";
import { StreamLifecycleService } from "./stream-lifecycle.service";
import { ExternalNumberModule } from "../external-number/external-number.module";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    RealtimeModule,
    RecordingModule,
    TwilioModule,
    TelephonyModule,
    ExternalNumberModule,
  ],
  controllers: [CallSessionController],
  providers: [
    MediaStreamGateway,
    MediaStreamService,
    CallSessionService,
    CallSessionRepository,
    AudioPacketService,
    StreamLifecycleService,
  ],
  exports: [CallSessionService],
})
export class MediaStreamModule {}
