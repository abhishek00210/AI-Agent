import { Module } from "@nestjs/common";
import { TwilioModule } from "../twilio/twilio.module";
import { ExotelProvider } from "./providers/exotel.provider";
import { TwilioProvider } from "./providers/twilio.provider";
import { TelephonyHealthService } from "./telephony-health.service";
import { TelephonyProviderFactory } from "./telephony-provider.factory";
import { ExotelSignatureService } from "./exotel-signature.service";

@Module({
  imports: [TwilioModule],
  providers: [
    TwilioProvider,
    ExotelProvider,
    TelephonyProviderFactory,
    TelephonyHealthService,
    ExotelSignatureService,
  ],
  exports: [
    TwilioModule,
    TwilioProvider,
    ExotelProvider,
    TelephonyProviderFactory,
    TelephonyHealthService,
    ExotelSignatureService,
  ],
})
export class TelephonyModule {}
