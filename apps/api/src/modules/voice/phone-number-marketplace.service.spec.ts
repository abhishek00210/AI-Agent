import { ConflictException } from "@nestjs/common";
import { PhoneNumberMarketplaceService } from "./phone-number-marketplace.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("PhoneNumberMarketplaceService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("searches supported Twilio inventory and includes markup pricing", async () => {
    const deps = createDependencies();
    deps.telephonyProvider.searchNumbers.mockResolvedValue([
      {
        provider: "TWILIO",
        providerSid: "",
        phoneNumber: "+14165551234",
        friendlyName: null,
        countryCode: "CA",
        region: "ON",
        locality: "Toronto",
        postalCode: null,
        capabilities: { voice: true, sms: true, mms: false },
      },
    ]);
    const service = createService(deps);

    const result = await service.search(context, { country: "CA", areaCode: "416" });

    expect(deps.telephonyProvider.searchNumbers).toHaveBeenCalledWith(
      expect.objectContaining({ countryCode: "CA", areaCode: "416", type: "local" }),
    );
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        phoneNumber: "+14165551234",
        providerCost: 1.15,
        customerPrice: 4.99,
        profitMargin: 3.84,
      }),
    );
  });

  it("prevents duplicate active purchases before charging Twilio", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findPurchasedByNumber.mockResolvedValue({
      id: "phone-1",
      organizationId: "org-1",
      phoneNumber: "+14165551234",
      twilioSid: "PN123",
      deletedAt: null,
      releasedAt: null,
    });
    const service = createService(deps);

    await expect(
      service.purchase(context, { phoneNumber: "+14165551234", country: "CA" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(deps.telephonyProvider.purchaseNumber).not.toHaveBeenCalled();
  });

  it("purchases, stores, assigns webhooks, counts usage, and audits", async () => {
    const deps = createDependencies();
    deps.telephonyProvider.purchaseNumber.mockResolvedValue({
      provider: "TWILIO",
      providerSid: "PN456",
      phoneNumber: "+14165559876",
      friendlyName: "Purchased",
      country: "CA",
      capabilities: { voice: true, sms: true, mms: false },
      voiceWebhookUrl: null,
      smsWebhookUrl: null,
    });
    deps.phoneNumbers.upsertFromProvider.mockResolvedValue(phoneNumberFixture());
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture());
    const service = createService(deps);

    const result = await service.purchase(context, { phoneNumber: "+14165559876", country: "CA" });

    expect(deps.billing.assertPhoneNumberPurchase).toHaveBeenCalledWith("org-1");
    expect(deps.telephonyProvider.purchaseNumber).toHaveBeenCalledWith("+14165559876", {
      friendlyName: "Zodo +14165559876",
      voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/voice",
      smsWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/sms",
    });
    expect(deps.phoneNumbers.upsertFromProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        phoneNumber: "+14165559876",
        purchaseSource: "TWILIO",
        providerCost: 1.15,
        customerPrice: 4.99,
        profitMargin: 3.84,
        isPurchased: true,
      }),
    );
    expect(deps.usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        resourceType: "PHONE_NUMBERS",
        metadata: expect.objectContaining({
          monthlyCost: 4.99,
          providerCost: 1.15,
          customerPrice: 4.99,
          profitMargin: 3.84,
          billingReady: true,
        }),
      }),
    );
    expect(result.id).toBe("phone-1");
    expect(deps.billing.schedulePhoneNumberAddonSync).toHaveBeenCalledWith("org-1");
  });

  it("routes Indian marketplace purchases through Exotel with INR markup defaults", async () => {
    const deps = createDependencies();
    deps.locales.getOrganizationLocale.mockResolvedValue({
      country: "IN",
      telephonyProvider: "EXOTEL",
    });
    deps.telephonyProvider.name = "EXOTEL";
    deps.telephonyProvider.purchaseNumber.mockResolvedValue({
      provider: "EXOTEL",
      providerSid: "exo-123",
      phoneNumber: "+919876543210",
      friendlyName: "Purchased India",
      country: "IN",
      capabilities: { voice: true, sms: true, mms: false },
      voiceWebhookUrl: null,
      smsWebhookUrl: null,
    });
    deps.phoneNumbers.upsertFromProvider.mockResolvedValue(
      phoneNumberFixture({
        phoneNumber: "+919876543210",
        country: "IN",
        countryCode: "IN",
        provider: "EXOTEL",
        twilioSid: "exo-123",
        purchaseSource: "EXTERNAL",
      }),
    );
    deps.phoneNumbers.findById.mockResolvedValue(
      phoneNumberFixture({
        phoneNumber: "+919876543210",
        country: "IN",
        countryCode: "IN",
        provider: "EXOTEL",
        twilioSid: "exo-123",
        purchaseSource: "EXTERNAL",
      }),
    );
    const service = createService(deps);

    await service.purchase(context, { phoneNumber: "+919876543210", country: "IN" });

    expect(deps.telephony.resolve).toHaveBeenCalledWith({
      organizationCountry: "IN",
      provider: "EXOTEL",
    });
    expect(deps.telephonyProvider.purchaseNumber).toHaveBeenCalledWith("+919876543210", {
      friendlyName: "Zodo +919876543210",
      voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/exotel/voice",
      smsWebhookUrl: "https://api.example.com/api/v1/webhooks/exotel/sms",
    });
    expect(deps.phoneNumbers.upsertFromProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: "+919876543210",
        provider: "EXOTEL",
        purchaseSource: "EXTERNAL",
        providerCost: 1.25,
        customerPrice: 399,
        profitMargin: 397.75,
      }),
    );
  });

  it("reassigns an active number and invalidates cached routing for the next call", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById
      .mockResolvedValueOnce(phoneNumberFixture({ agentId: "agent-a" }))
      .mockResolvedValueOnce(phoneNumberFixture({ agentId: "agent-b" }));
    deps.phoneNumbers.agentExists.mockResolvedValue({
      id: "agent-b",
      name: "Sales",
      status: "ACTIVE",
      language: "English",
    });
    const service = createService(deps);

    const result = await service.assignAgent(context, "phone-1", { agentId: "agent-b" });

    expect(deps.telephonyProvider.assignNumber).toHaveBeenCalledWith("PN123", {
      voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/voice",
      smsWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/sms",
    });
    expect(deps.phoneNumbers.assignAgent).toHaveBeenCalledWith("org-1", "phone-1", "agent-b");
    expect(deps.routing.invalidate).toHaveBeenCalledWith("+14165559876");
    expect(result.agentId).toBe("agent-b");
  });

  it("releases tenant-owned Twilio numbers and removes them from routing", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture());
    deps.phoneNumbers.markReleased.mockResolvedValue(phoneNumberFixture({ status: "INACTIVE" }));
    const service = createService(deps);

    const result = await service.release(context, "phone-1");

    expect(deps.telephonyProvider.releaseNumber).toHaveBeenCalledWith("PN123");
    expect(deps.phoneNumbers.markReleased).toHaveBeenCalledWith("org-1", "phone-1");
    expect(deps.usage.decrement).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", resourceType: "PHONE_NUMBERS" }),
    );
    expect(result.status).toBe("INACTIVE");
    expect(deps.billing.schedulePhoneNumberAddonSync).toHaveBeenCalledWith("org-1");
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new PhoneNumberMarketplaceService(
    deps.phoneNumbers as never,
    deps.telephony as never,
    deps.webhookUrls as never,
    deps.routing as never,
    deps.config as never,
    deps.gates as never,
    deps.usage as never,
    deps.billing as never,
    deps.locales as never,
  );
}

function createDependencies() {
  const deps = {
    phoneNumbers: {
      findPurchasedByNumber: jest.fn().mockResolvedValue(null),
      upsertFromProvider: jest.fn(),
      findById: jest.fn(),
      agentExists: jest.fn(),
      assignAgent: jest.fn(),
      updateStatus: jest.fn(),
      markReleased: jest.fn(),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    telephonyProvider: {
      name: "TWILIO",
      searchNumbers: jest.fn(),
      purchaseNumber: jest.fn(),
      assignNumber: jest.fn(),
      releaseNumber: jest.fn(),
    },
    webhookUrls: {
      voiceUrl: jest.fn(
        (provider = "TWILIO") =>
          `https://api.example.com/api/v1/webhooks/${String(provider).toLowerCase()}/voice`,
      ),
      smsUrl: jest.fn(
        (provider = "TWILIO") =>
          `https://api.example.com/api/v1/webhooks/${String(provider).toLowerCase()}/sms`,
      ),
    },
    routing: { invalidate: jest.fn() },
    config: { get: jest.fn().mockReturnValue(undefined) },
    gates: { assertAvailable: jest.fn() },
    usage: { increment: jest.fn(), decrement: jest.fn() },
    billing: {
      assertPhoneNumberPurchase: jest.fn(),
      schedulePhoneNumberAddonSync: jest.fn(),
    },
    locales: {
      getOrganizationLocale: jest.fn().mockResolvedValue({
        country: "CA",
        telephonyProvider: "TWILIO",
      }),
    },
    telephony: {
      resolve: jest.fn(),
      byName: jest.fn(),
    },
  };
  deps.telephony.resolve.mockImplementation(() => deps.telephonyProvider);
  deps.telephony.byName.mockImplementation(() => deps.telephonyProvider);
  return deps;
}

function phoneNumberFixture(
  overrides: Partial<{
    agentId: string | null;
    status: string;
    phoneNumber: string;
    country: string;
    countryCode: string;
    provider: string;
    twilioSid: string;
    purchaseSource: string;
  }> = {},
) {
  const now = new Date("2026-06-22T12:00:00.000Z");
  return {
    id: "phone-1",
    organizationId: "org-1",
    agentId: overrides.agentId ?? null,
    phoneNumber: overrides.phoneNumber ?? "+14165559876",
    friendlyName: "Purchased",
    country: overrides.country ?? "CA",
    countryCode: overrides.countryCode ?? "CA",
    areaCode: "416",
    capabilities: { voice: true, sms: true, mms: false },
    provider: overrides.provider ?? "TWILIO",
    purchaseSource: overrides.purchaseSource ?? "TWILIO",
    status: overrides.status ?? "ACTIVE",
    twilioSid: overrides.twilioSid ?? "PN123",
    voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/voice",
    smsWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/sms",
    monthlyCost: 4.99,
    providerCost: 1.15,
    customerPrice: 4.99,
    profitMargin: 3.84,
    isPurchased: true,
    purchasedAt: now,
    releasedAt: null,
    createdAt: now,
    updatedAt: now,
    agent: null,
  };
}
