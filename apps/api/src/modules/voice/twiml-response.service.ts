import { Injectable } from "@nestjs/common";
import { VoiceWebhookUrlService } from "./voice-webhook-url.service";
import type { TelephonyProviderName } from "../telephony/providers/telephony-provider.interface";

@Injectable()
export class TwiMLResponseService {
  constructor(private readonly urls: VoiceWebhookUrlService) {}

  routing(provider: TelephonyProviderName = "TWILIO"): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Response>",
      "<Connect>",
      `<Stream url="${escapeXml(this.urls.mediaStreamUrl(provider))}" />`,
      "</Connect>",
      "</Response>",
    ].join("");
  }

  unavailable(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Response>",
      "<Say>We are unable to take your call at the moment.</Say>",
      "<Hangup/>",
      "</Response>",
    ].join("");
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
