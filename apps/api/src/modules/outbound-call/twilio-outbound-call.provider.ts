import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TelephonyProviderFactory } from "../telephony/telephony-provider.factory";
import { VoiceWebhookUrlService } from "../voice/voice-webhook-url.service";
import { OutboundCallProvider, StartOutboundCallInput } from "./outbound-call.provider";

@Injectable()
export class TwilioOutboundCallProvider extends OutboundCallProvider {
  constructor(
    private readonly telephony: TelephonyProviderFactory,
    private readonly prisma: PrismaService,
    private readonly webhookUrls: VoiceWebhookUrlService,
  ) {
    super();
  }

  async startCall(input: StartOutboundCallInput) {
    const provider = await this.providerForFromNumber(input.from);
    return provider.createOutboundCall({
      to: input.to,
      from: input.from,
      voiceUrl:
        provider.name === "EXOTEL"
          ? this.webhookUrls.mediaStreamUrl("EXOTEL")
          : this.webhookUrls.voiceUrl("TWILIO"),
      statusCallbackUrl: this.webhookUrls.outboundStatusUrl(provider.name),
    });
  }

  async cancelCall(providerCallSid: string) {
    const provider = await this.providerForCallSid(providerCallSid);
    return provider.endCall(providerCallSid, { status: "canceled" });
  }

  async leaveVoicemailOrHangUp(input: {
    providerCallSid: string;
    mode: "LEAVE_MESSAGE" | "HANG_UP";
    message: string;
  }) {
    const message =
      input.mode === "LEAVE_MESSAGE"
        ? input.message
        : "Sorry we missed you. We will try again later.";
    const provider = await this.providerForCallSid(input.providerCallSid);
    return provider.endCall(input.providerCallSid, { message });
  }

  private async providerForFromNumber(phoneNumber: string) {
    const record = await this.prisma.phoneNumber.findFirst({
      where: { phoneNumber, deletedAt: null },
      select: { provider: true, countryCode: true, country: true },
      orderBy: { createdAt: "desc" },
    });
    return record
      ? this.telephony.resolve({
          provider: record.provider,
          organizationCountry: record.countryCode ?? record.country,
        })
      : this.telephony.resolve();
  }

  private async providerForCallSid(providerCallSid: string) {
    const outbound = await this.prisma.outboundCall.findFirst({
      where: { providerCallSid },
      select: { phoneNumber: { select: { provider: true, countryCode: true, country: true } } },
    });
    return outbound?.phoneNumber
      ? this.telephony.resolve({
          provider: outbound.phoneNumber.provider,
          organizationCountry: outbound.phoneNumber.countryCode ?? outbound.phoneNumber.country,
        })
      : this.telephony.resolve();
  }
}
