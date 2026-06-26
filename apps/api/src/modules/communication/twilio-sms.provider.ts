import { Injectable } from "@nestjs/common";
import { OrganizationLocaleService } from "../organization-locale/organization-locale.service";
import { TelephonyProviderFactory } from "../telephony/telephony-provider.factory";
import type { SendSmsProviderInput, SendSmsProviderResult, SMSProvider } from "./sms-provider";

@Injectable()
export class TwilioSMSProvider implements SMSProvider {
  readonly name = "TWILIO" as const;

  constructor(
    private readonly telephony: TelephonyProviderFactory,
    private readonly locales: OrganizationLocaleService,
  ) {}

  async send(input: SendSmsProviderInput): Promise<SendSmsProviderResult> {
    const locale = await this.locales.getOrganizationLocale(input.organizationId);
    const result = await this.telephony
      .resolve({ organizationCountry: locale.country, provider: locale.telephonyProvider })
      .sendSms(input);
    return {
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      status: result.status ?? "queued",
    };
  }
}
