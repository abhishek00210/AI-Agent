import type {
  BillingProvider,
  Country,
  Currency,
  Language,
  PhoneNumberProvider,
} from "../../../generated/prisma";

export interface OrganizationLocaleDefaults {
  country: Country;
  countryCode: Country;
  currency: Currency;
  timezone: string;
  language: Language;
  telephonyProvider: PhoneNumberProvider;
  paymentProvider: BillingProvider;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  businessHoursTimezone: string;
  taxRegion: string;
  taxRules: {
    label: string;
    strategy: "GST_HST" | "GST";
    invoiceLabel: string;
  };
  phoneRegion: "CA" | "IN";
}

export const COUNTRY_DEFAULTS: Record<Country, OrganizationLocaleDefaults> = {
  CA: {
    country: "CA",
    countryCode: "CA",
    currency: "CAD",
    timezone: "America/Toronto",
    language: "en",
    telephonyProvider: "TWILIO",
    paymentProvider: "STRIPE",
    dateFormat: "yyyy-MM-dd",
    timeFormat: "HH:mm",
    numberFormat: "+1",
    businessHoursTimezone: "America/Toronto",
    taxRegion: "GST/HST",
    taxRules: {
      label: "GST/HST",
      strategy: "GST_HST",
      invoiceLabel: "GST/HST",
    },
    phoneRegion: "CA",
  },
  IN: {
    country: "IN",
    countryCode: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    language: "en",
    telephonyProvider: "EXOTEL",
    paymentProvider: "RAZORPAY",
    dateFormat: "dd-MM-yyyy",
    timeFormat: "hh:mm a",
    numberFormat: "+91",
    businessHoursTimezone: "Asia/Kolkata",
    taxRegion: "GST",
    taxRules: {
      label: "GST",
      strategy: "GST",
      invoiceLabel: "GST",
    },
    phoneRegion: "IN",
  },
};

export function normalizeCountryCode(value?: string | null): Country {
  const normalized = value?.trim().toUpperCase();
  return normalized === "IN" ? "IN" : "CA";
}

export function defaultsForCountry(value?: string | null): OrganizationLocaleDefaults {
  return COUNTRY_DEFAULTS[normalizeCountryCode(value)];
}
