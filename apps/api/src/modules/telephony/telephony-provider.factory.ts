import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExotelProvider } from "./providers/exotel.provider";
import { TelephonyProvider, TelephonyProviderName } from "./providers/telephony-provider.interface";
import { TwilioProvider } from "./providers/twilio.provider";

const DEFAULT_PROVIDER_BY_COUNTRY: Record<string, TelephonyProviderName> = {
  CA: "TWILIO",
  IN: "EXOTEL",
};

@Injectable()
export class TelephonyProviderFactory {
  private readonly providers: Record<TelephonyProviderName, TelephonyProvider>;

  constructor(
    private readonly config: ConfigService,
    twilio: TwilioProvider,
    exotel: ExotelProvider,
  ) {
    this.providers = {
      TWILIO: twilio,
      EXOTEL: exotel,
    };
  }

  resolve(input: { organizationCountry?: string | null; provider?: string | null } = {}) {
    const providerName =
      normalizeProvider(input.provider) ?? this.providerForCountry(input.organizationCountry);
    return this.providers[providerName];
  }

  byName(provider: string | null | undefined) {
    return this.providers[normalizeProvider(provider) ?? this.defaultProvider()];
  }

  all() {
    return Object.values(this.providers);
  }

  providerForCountry(country?: string | null): TelephonyProviderName {
    const normalized = country?.trim().toUpperCase();
    const configured = this.config.get<string>(`telephony.providers.${normalized ?? ""}`);
    const explicit = normalizeProvider(configured);
    if (explicit) return explicit;
    if (normalized && DEFAULT_PROVIDER_BY_COUNTRY[normalized]) {
      return DEFAULT_PROVIDER_BY_COUNTRY[normalized];
    }
    return this.defaultProvider();
  }

  private defaultProvider(): TelephonyProviderName {
    return normalizeProvider(this.config.get<string>("telephony.defaultProvider")) ?? "TWILIO";
  }
}

function normalizeProvider(provider?: string | null): TelephonyProviderName | null {
  const normalized = provider?.trim().toUpperCase();
  if (normalized === "TWILIO" || normalized === "EXOTEL") return normalized;
  return null;
}
