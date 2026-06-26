import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CountryCode } from "libphonenumber-js";
import { Prisma } from "../../../generated/prisma";
import { FeatureGateService } from "../billing/feature-gate.service";
import { BillingService } from "../billing/billing.service";
import type { TenantContext } from "../tenant/tenant.service";
import { TelephonyProviderFactory } from "../telephony/telephony-provider.factory";
import { UsageService } from "../usage/usage.service";
import type {
  AssignPhoneNumberAgentDto,
  PurchaseMarketplaceNumberDto,
  SearchMarketplaceNumbersQueryDto,
} from "./dto/phone-number.dto";
import { normalizeE164 } from "./e164";
import { PhoneNumberRepository } from "./repositories/phone-number.repository";
import { CallRoutingService } from "./call-routing.service";
import { toPhoneNumberResponse } from "./phone-number.service";
import { VoiceWebhookUrlService } from "./voice-webhook-url.service";
import { OrganizationLocaleService } from "../organization-locale/organization-locale.service";

const SUPPORTED_COUNTRIES = new Set(["CA", "IN"]);

@Injectable()
export class PhoneNumberMarketplaceService {
  constructor(
    private readonly phoneNumbers: PhoneNumberRepository,
    private readonly telephony: TelephonyProviderFactory,
    private readonly webhookUrls: VoiceWebhookUrlService,
    private readonly routing: CallRoutingService,
    private readonly config: ConfigService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly billing?: BillingService,
    @Optional() private readonly locales?: OrganizationLocaleService,
  ) {}

  async search(context: TenantContext, query: SearchMarketplaceNumbersQueryDto) {
    const countryCode = normalizeCountry(query.country);
    const locale = await this.locales?.getOrganizationLocale(context.organizationId);
    this.assertOrganizationCountry(locale?.country, countryCode);
    const type = query.type ?? "local";
    const pricing = this.pricing(countryCode);
    const provider = this.telephony.resolve({
      organizationCountry: countryCode,
      provider: locale?.telephonyProvider,
    });
    const numbers = await provider.searchNumbers({
      countryCode,
      areaCode: query.areaCode,
      contains: query.contains,
      type,
      voice: query.voice ?? true,
      sms: query.sms,
      limit: query.limit ?? 20,
    });

    await this.audit(context, "phone_number.marketplace_searched", undefined, {
      countryCode,
      areaCode: query.areaCode,
      type,
      resultCount: numbers.length,
    });

    return {
      countryCode,
      provider: provider.name,
      type,
      data: numbers.map((number) => ({
        provider: number.provider,
        phoneNumber: number.phoneNumber,
        country: number.countryCode ?? number.country ?? countryCode,
        region: number.region,
        locality: number.locality,
        postalCode: number.postalCode,
        capabilities: number.capabilities,
        monthlyCost: pricing.customerPrice,
        setupCost: 0,
        providerCost: pricing.providerCost,
        customerPrice: pricing.customerPrice,
        profitMargin: pricing.profitMargin,
      })),
    };
  }

  async purchase(context: TenantContext, input: PurchaseMarketplaceNumberDto) {
    const countryCode = normalizeCountry(input.country);
    const locale = await this.locales?.getOrganizationLocale(context.organizationId);
    this.assertOrganizationCountry(locale?.country, countryCode);
    const phoneNumber = normalizeE164(input.phoneNumber, countryCode as CountryCode);
    const existing = await this.phoneNumbers.findPurchasedByNumber(phoneNumber);
    if (existing && !existing.releasedAt && !existing.deletedAt) {
      throw new ConflictException("Phone number has already been purchased.");
    }

    if (this.billing) {
      await this.billing.assertPhoneNumberPurchase(context.organizationId);
    } else {
      await this.gates?.assertAvailable(context.organizationId, "phoneNumbers", 1);
    }
    const agent = input.agentId
      ? await this.assertAgent(context.organizationId, input.agentId)
      : null;
    const pricing = this.pricing(countryCode);
    const provider = this.telephony.resolve({
      organizationCountry: countryCode,
      provider: locale?.telephonyProvider,
    });
    const purchased = await provider.purchaseNumber(phoneNumber, {
      friendlyName: `Zodo ${phoneNumber}`,
      voiceWebhookUrl: this.webhookUrls.voiceUrl(provider.name),
      smsWebhookUrl: this.webhookUrls.smsUrl(provider.name),
    });

    const record = await this.phoneNumbers.upsertFromProvider({
      organizationId: context.organizationId,
      phoneNumber: normalizeE164(purchased.phoneNumber),
      friendlyName: purchased.friendlyName ?? `Purchased ${phoneNumber}`,
      country: purchased.country ?? countryCode,
      countryCode,
      areaCode: input.areaCode ?? areaCodeFromE164(phoneNumber, countryCode),
      capabilities: purchased.capabilities as Prisma.InputJsonValue,
      twilioSid: purchased.providerSid,
      voiceWebhookUrl: this.webhookUrls.voiceUrl(provider.name),
      smsWebhookUrl: this.webhookUrls.smsUrl(provider.name),
      purchaseSource: provider.name === "TWILIO" ? "TWILIO" : "EXTERNAL",
      monthlyCost: pricing.customerPrice,
      providerCost: pricing.providerCost,
      customerPrice: pricing.customerPrice,
      profitMargin: pricing.profitMargin,
      isPurchased: true,
      purchasedAt: new Date(),
      provider: provider.name,
    });

    if (agent) {
      await this.phoneNumbers.assignAgent(context.organizationId, record.id, agent.id);
    }
    this.routing.invalidate(record.phoneNumber);
    await this.usage?.increment({
      organizationId: context.organizationId,
      resourceType: "PHONE_NUMBERS",
      idempotencyKey: `phone-number:purchase:${record.id}`,
      metadata: {
        phoneNumberId: record.id,
        purchaseSource: provider.name,
        monthlyCost: pricing.customerPrice,
        providerCost: pricing.providerCost,
        customerPrice: pricing.customerPrice,
        profitMargin: pricing.profitMargin,
        billingReady: true,
      },
    });
    await this.audit(context, "phone_number.purchased", record.id, {
      phoneNumber: record.phoneNumber,
      agentId: agent?.id,
      provider: provider.name,
      providerCost: pricing.providerCost,
      customerPrice: pricing.customerPrice,
      profitMargin: pricing.profitMargin,
    });
    await this.billing?.schedulePhoneNumberAddonSync(context.organizationId);

    return toPhoneNumberResponse(
      (await this.phoneNumbers.findById(context.organizationId, record.id))!,
    );
  }

  async release(context: TenantContext, phoneNumberId: string) {
    const phoneNumber = await this.getScopedPhoneNumber(context.organizationId, phoneNumberId);
    if (!phoneNumber.twilioSid) {
      throw new BadRequestException("Phone number does not have a provider number ID.");
    }
    await this.telephony.byName(phoneNumber.provider).releaseNumber(phoneNumber.twilioSid);
    const released = await this.phoneNumbers.markReleased(context.organizationId, phoneNumberId);
    this.routing.invalidate(phoneNumber.phoneNumber);
    await this.usage?.decrement({
      organizationId: context.organizationId,
      resourceType: "PHONE_NUMBERS",
      idempotencyKey: `phone-number:release:${phoneNumberId}`,
      metadata: { phoneNumberId, phoneNumber: phoneNumber.phoneNumber },
    });
    await this.audit(context, "phone_number.released", phoneNumber.id, {
      phoneNumber: phoneNumber.phoneNumber,
      provider: phoneNumber.provider,
      providerSid: phoneNumber.twilioSid,
    });
    await this.billing?.schedulePhoneNumberAddonSync(context.organizationId);
    return toPhoneNumberResponse(released);
  }

  async assignAgent(
    context: TenantContext,
    phoneNumberId: string,
    input: AssignPhoneNumberAgentDto,
  ) {
    const phoneNumber = await this.getScopedPhoneNumber(context.organizationId, phoneNumberId);
    const agent = await this.assertAgent(context.organizationId, input.agentId);
    if (phoneNumber.twilioSid) {
      await this.telephony.byName(phoneNumber.provider).assignNumber(phoneNumber.twilioSid, {
        voiceWebhookUrl: this.webhookUrls.voiceUrl(phoneNumber.provider),
        smsWebhookUrl: this.webhookUrls.smsUrl(phoneNumber.provider),
      });
    }
    await this.phoneNumbers.assignAgent(context.organizationId, phoneNumberId, agent.id);
    this.routing.invalidate(phoneNumber.phoneNumber);
    await this.audit(context, "phone_number.marketplace_assigned", phoneNumber.id, {
      agentId: agent.id,
      phoneNumber: phoneNumber.phoneNumber,
    });
    return toPhoneNumberResponse(
      (await this.phoneNumbers.findById(context.organizationId, phoneNumberId))!,
    );
  }

  async activate(context: TenantContext, phoneNumberId: string) {
    const phoneNumber = await this.getScopedPhoneNumber(context.organizationId, phoneNumberId);
    if (phoneNumber.twilioSid) {
      await this.telephony.byName(phoneNumber.provider).assignNumber(phoneNumber.twilioSid, {
        voiceWebhookUrl: this.webhookUrls.voiceUrl(phoneNumber.provider),
        smsWebhookUrl: this.webhookUrls.smsUrl(phoneNumber.provider),
      });
    }
    const status = phoneNumber.agentId ? "ACTIVE" : "UNASSIGNED";
    await this.phoneNumbers.updateStatus(context.organizationId, phoneNumberId, status);
    this.routing.invalidate(phoneNumber.phoneNumber);
    await this.audit(context, "phone_number.activated", phoneNumber.id, { status });
    return toPhoneNumberResponse(
      (await this.phoneNumbers.findById(context.organizationId, phoneNumberId))!,
    );
  }

  private async getScopedPhoneNumber(organizationId: string, phoneNumberId: string) {
    const phoneNumber = await this.phoneNumbers.findById(organizationId, phoneNumberId);
    if (!phoneNumber) throw new NotFoundException("Phone number not found.");
    return phoneNumber;
  }

  private async assertAgent(organizationId: string, agentId: string) {
    const agent = await this.phoneNumbers.agentExists(organizationId, agentId);
    if (!agent) throw new NotFoundException("Agent not found.");
    return agent;
  }

  private pricing(countryCode: string) {
    const providerCost = numberFromConfig(
      this.config,
      `PHONE_NUMBER_PROVIDER_COST_${countryCode}`,
      numberFromConfig(this.config, `TWILIO_NUMBER_PROVIDER_COST_${countryCode}`, defaultProviderCost(countryCode)),
    );
    const customerPrice = numberFromConfig(
      this.config,
      `PHONE_NUMBER_CUSTOMER_PRICE_${countryCode}`,
      numberFromConfig(this.config, "PHONE_NUMBER_CUSTOMER_PRICE_CAD", defaultCustomerPrice(countryCode)),
    );
    return {
      providerCost,
      customerPrice,
      profitMargin: roundMoney(customerPrice - providerCost),
    };
  }

  private assertOrganizationCountry(organizationCountry: string | undefined, requestedCountry: string) {
    if (organizationCountry && organizationCountry !== requestedCountry) {
      throw new BadRequestException(
        `This organization is configured for ${organizationCountry} numbers. Change the organization country before buying ${requestedCountry} numbers.`,
      );
    }
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.phoneNumbers.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "PhoneNumber",
      entityId,
      metadata,
    });
  }
}

function normalizeCountry(country: string) {
  const countryCode = country.trim().toUpperCase();
  if (!SUPPORTED_COUNTRIES.has(countryCode)) {
    throw new BadRequestException("Country is not supported for number purchase.");
  }
  return countryCode;
}

function defaultProviderCost(countryCode: string) {
  return { CA: 1.15, US: 1.15, GB: 1.5, AU: 1.75, IN: 1.25 }[countryCode] ?? 1.15;
}

function defaultCustomerPrice(countryCode: string) {
  return { CA: 4.99, IN: 399 }[countryCode] ?? 4.99;
}

function numberFromConfig(config: ConfigService, key: string, fallback: number) {
  const value = Number(config.get<string>(key) ?? fallback);
  return Number.isFinite(value) ? roundMoney(value) : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function areaCodeFromE164(phoneNumber: string, countryCode: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if ((countryCode === "CA" || countryCode === "US") && digits.length >= 4) {
    return digits.slice(1, 4);
  }
  return null;
}
