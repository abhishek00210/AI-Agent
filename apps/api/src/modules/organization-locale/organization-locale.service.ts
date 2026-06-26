import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  BillingProvider,
  Country,
  Currency,
  Language,
  PhoneNumberProvider,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { defaultsForCountry, normalizeCountryCode } from "./organization-locale.defaults";

export interface OrganizationLocale {
  organizationId: string;
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

const CACHE_TTL_MS = 60_000;

@Injectable()
export class OrganizationLocaleService {
  private readonly cache = new Map<string, { expiresAt: number; locale: OrganizationLocale }>();

  constructor(private readonly prisma: PrismaService) {}

  defaults(country?: string | null) {
    return defaultsForCountry(country);
  }

  async getOrganizationLocale(organizationId: string): Promise<OrganizationLocale> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) return cached.locale;

    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        id: true,
        country: true,
        countryCode: true,
        currency: true,
        timezone: true,
        language: true,
        telephonyProvider: true,
        paymentProvider: true,
        dateFormat: true,
        timeFormat: true,
        numberFormat: true,
        businessHoursTimezone: true,
        taxRegion: true,
      },
    });
    if (!organization) throw new NotFoundException("Organization not found.");

    const fallback = defaultsForCountry(organization.country ?? organization.countryCode);
    const locale: OrganizationLocale = {
      organizationId: organization.id,
      country: organization.country ?? fallback.country,
      countryCode: normalizeCountryCode(organization.countryCode ?? organization.country),
      currency: organization.currency ?? fallback.currency,
      timezone: organization.timezone || fallback.timezone,
      language: organization.language ?? fallback.language,
      telephonyProvider: organization.telephonyProvider ?? fallback.telephonyProvider,
      paymentProvider: organization.paymentProvider ?? fallback.paymentProvider,
      dateFormat: organization.dateFormat || fallback.dateFormat,
      timeFormat: organization.timeFormat || fallback.timeFormat,
      numberFormat: organization.numberFormat || fallback.numberFormat,
      businessHoursTimezone: organization.businessHoursTimezone || fallback.businessHoursTimezone,
      taxRegion: organization.taxRegion || fallback.taxRegion,
      taxRules: fallback.taxRules,
      phoneRegion: fallback.phoneRegion,
    };
    this.cache.set(organizationId, { expiresAt: Date.now() + CACHE_TTL_MS, locale });
    return locale;
  }

  async getCurrency(organizationId: string) {
    return (await this.getOrganizationLocale(organizationId)).currency;
  }

  async getTimezone(organizationId: string) {
    return (await this.getOrganizationLocale(organizationId)).timezone;
  }

  async getCountry(organizationId: string) {
    return (await this.getOrganizationLocale(organizationId)).country;
  }

  async getTaxRules(organizationId: string) {
    return (await this.getOrganizationLocale(organizationId)).taxRules;
  }

  async getPhoneRegion(organizationId: string) {
    return (await this.getOrganizationLocale(organizationId)).phoneRegion;
  }

  invalidate(organizationId: string) {
    this.cache.delete(organizationId);
  }
}
