import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { defaultsForCountry } from "./organization-locale.defaults";

@Injectable()
export class OrganizationProvisioningService {
  buildCreateData(input: {
    name: string;
    slug: string;
    country: "CA" | "IN";
    industry?: string | null;
    companySize?: string | null;
    trialStartsAt: Date;
    trialEndsAt: Date;
  }): Prisma.OrganizationCreateInput {
    const locale = defaultsForCountry(input.country);
    return {
      name: input.name,
      slug: input.slug,
      industry: clean(input.industry),
      companySize: clean(input.companySize),
      provisionStatus: "PROVISIONED",
      plan: "STARTER",
      trialStartsAt: input.trialStartsAt,
      trialEndsAt: input.trialEndsAt,
      trialStatus: "ACTIVE",
      country: locale.country,
      countryCode: locale.countryCode,
      currency: locale.currency,
      timezone: locale.timezone,
      language: locale.language,
      telephonyProvider: locale.telephonyProvider,
      paymentProvider: locale.paymentProvider,
      dateFormat: locale.dateFormat,
      timeFormat: locale.timeFormat,
      numberFormat: locale.numberFormat,
      businessHoursTimezone: locale.businessHoursTimezone,
      taxRegion: locale.taxRegion,
    };
  }

  metadata(country: "CA" | "IN") {
    const locale = defaultsForCountry(country);
    return {
      country: locale.country,
      currency: locale.currency,
      timezone: locale.timezone,
      telephonyProvider: locale.telephonyProvider,
      paymentProvider: locale.paymentProvider,
      taxRegion: locale.taxRegion,
      language: locale.language,
    };
  }
}

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}
