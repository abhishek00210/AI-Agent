import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PaymentCountry,
  PaymentProvider,
  PaymentProviderName,
} from "./providers/payment-provider.interface";
import { RazorpayProvider } from "./providers/razorpay.provider";
import { StripeProvider } from "./providers/stripe.provider";

const DEFAULT_PROVIDER_BY_COUNTRY: Record<PaymentCountry, PaymentProviderName> = {
  CA: "STRIPE",
  IN: "RAZORPAY",
};

@Injectable()
export class PaymentProviderFactory {
  private readonly providers: Record<PaymentProviderName, PaymentProvider>;

  constructor(
    private readonly config: ConfigService,
    stripe: StripeProvider,
    razorpay: RazorpayProvider,
  ) {
    this.providers = {
      STRIPE: stripe,
      RAZORPAY: razorpay,
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

  providerForCountry(country?: string | null): PaymentProviderName {
    const normalized = normalizeCountry(country);
    const configured = this.config.get<string>(`payments.providers.${normalized ?? ""}`);
    const explicit = normalizeProvider(configured);
    if (explicit) return explicit;
    if (normalized) return DEFAULT_PROVIDER_BY_COUNTRY[normalized];
    return this.defaultProvider();
  }

  private defaultProvider(): PaymentProviderName {
    return normalizeProvider(this.config.get<string>("payments.defaultProvider")) ?? "STRIPE";
  }
}

function normalizeCountry(country?: string | null): PaymentCountry | null {
  const normalized = country?.trim().toUpperCase();
  if (normalized === "CA" || normalized === "IN") return normalized;
  return null;
}

function normalizeProvider(provider?: string | null): PaymentProviderName | null {
  const normalized = provider?.trim().toUpperCase();
  if (normalized === "STRIPE" || normalized === "RAZORPAY") return normalized;
  return null;
}
