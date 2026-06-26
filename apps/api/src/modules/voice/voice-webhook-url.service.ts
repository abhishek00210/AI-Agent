import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExotelSignatureService } from "../telephony/exotel-signature.service";
import type { TelephonyProviderName } from "../telephony/providers/telephony-provider.interface";

@Injectable()
export class VoiceWebhookUrlService {
  constructor(
    private readonly config: ConfigService,
    private readonly exotelSignatures?: ExotelSignatureService,
  ) {}

  voiceUrl(provider: TelephonyProviderName = "TWILIO"): string {
    return provider === "EXOTEL"
      ? `${this.baseUrl}/api/v1/webhooks/exotel/voice`
      : `${this.baseUrl}/api/v1/webhooks/twilio/voice`;
  }

  smsUrl(provider: TelephonyProviderName = "TWILIO"): string {
    return provider === "EXOTEL"
      ? `${this.baseUrl}/api/v1/webhooks/exotel/sms/inbound`
      : `${this.baseUrl}/api/v1/webhooks/twilio/sms/inbound`;
  }

  outboundStatusUrl(provider: TelephonyProviderName = "TWILIO"): string {
    return provider === "EXOTEL"
      ? `${this.baseUrl}/api/v1/webhooks/exotel/outbound-status`
      : `${this.baseUrl}/api/v1/webhooks/twilio/outbound-status`;
  }

  mediaStreamUrl(provider: TelephonyProviderName = "TWILIO"): string {
    if (provider === "EXOTEL") {
      const token = this.exotelSignatures?.streamToken();
      return `${this.websocketBaseUrl}/ws/exotel-media${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    }
    return `${this.websocketBaseUrl}/ws/twilio-media`;
  }

  private get baseUrl(): string {
    return this.config.getOrThrow<string>("voice.webhookBaseUrl").replace(/\/$/, "");
  }

  private get websocketBaseUrl(): string {
    const baseUrl = this.baseUrl;
    if (baseUrl.startsWith("https://")) {
      return baseUrl.replace(/^https:\/\//, "wss://");
    }

    if (baseUrl.startsWith("http://")) {
      return baseUrl.replace(/^http:\/\//, "ws://");
    }

    return baseUrl;
  }
}
