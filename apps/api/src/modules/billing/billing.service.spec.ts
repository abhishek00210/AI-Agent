import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BillingService } from "./billing.service";

describe("BillingService", () => {
  const config = {
    get: jest.fn((key: string): unknown => {
      if (key === "stripe.prices.STARTER") return "price_starter";
      if (key === "stripe.prices") return { STARTER: "price_starter" };
      return undefined;
    }),
    getOrThrow: jest.fn(() => "https://agent.zodo.ca"),
  };
  const billing = {
    findCustomer: jest.fn(),
    upsertCustomer: jest.fn(),
    createAudit: jest.fn(),
    currentSubscription: jest.fn(),
    updatePendingPlan: jest.fn(),
    activePhoneNumberInventory: jest.fn(),
    phoneNumberAddon: jest.fn(),
    organizationBillingSettings: jest.fn(),
  };
  const gates = { usage: jest.fn(), resolve: jest.fn() };
  const queue = { depth: jest.fn(), enqueuePhoneNumberSync: jest.fn() };
  const provider = {
    name: "STRIPE",
    isConfigured: jest.fn(() => true),
    createCustomer: jest.fn(),
    createCheckoutSession: jest.fn(),
    getCustomerPortal: jest.fn(),
    cancelSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    pauseSubscription: jest.fn(),
    resumeSubscription: jest.fn(),
  };
  const payments = { byName: jest.fn(() => provider), resolve: jest.fn(() => provider) };
  const service = new BillingService(
    config as never,
    billing as never,
    gates as never,
    queue as never,
    payments as never,
  );
  const context = {
    organizationId: "org-1",
    userId: "user-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    billing.organizationBillingSettings.mockResolvedValue({
      country: "CA",
      countryCode: "CA",
      currency: "CAD",
      paymentProvider: "STRIPE",
      gstNumber: null,
      billingCompanyName: null,
      billingAddress: null,
      taxRegion: null,
    });
  });

  it("creates a tenant customer and hosted checkout without changing subscription state", async () => {
    billing.findCustomer.mockResolvedValue(null);
    provider.createCustomer.mockResolvedValue({ id: "cus_1", email: context.email, provider: "STRIPE" });
    billing.upsertCustomer.mockResolvedValue({ id: "bc-1", providerCustomerId: "cus_1" });
    provider.createCheckoutSession.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/x",
      provider: "STRIPE",
    });
    billing.currentSubscription.mockResolvedValue(null);

    await expect(service.checkout(context, "STARTER")).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.com/x",
    });
    expect(provider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", priceId: "price_starter" }),
    );
    expect(billing.currentSubscription).toHaveBeenCalledWith("org-1");
  });

  it("creates a portal only for the scoped billing customer", async () => {
    billing.findCustomer.mockResolvedValue({ id: "bc-1", providerCustomerId: "cus_1" });
    provider.getCustomerPortal.mockResolvedValue({
      id: "bps_1",
      url: "https://billing.stripe.com/x",
    });
    await expect(service.portal(context)).resolves.toEqual({
      portalUrl: "https://billing.stripe.com/x",
    });
    expect(billing.findCustomer).toHaveBeenCalledWith("org-1", "STRIPE");
  });

  it("rejects portal access when the tenant has no customer", async () => {
    billing.findCustomer.mockResolvedValue(null);
    await expect(service.portal(context)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("restricts billing mutations to tenant administrators", async () => {
    await expect(
      service.checkout({ ...context, role: "MEMBER" }, "STARTER"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not update local cancellation state before a webhook", async () => {
    billing.currentSubscription.mockResolvedValue({
      id: "sub-local",
      providerSubscriptionId: "sub_1",
      provider: "STRIPE",
    });
    await expect(service.cancel(context)).resolves.toEqual({
      accepted: true,
      pendingWebhook: true,
      mode: "PERIOD_END",
    });
    expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_1", "PERIOD_END");
  });

  it("requests an immediate prorated plan change without changing local entitlements", async () => {
    billing.currentSubscription.mockResolvedValue({
      id: "sub-local",
      providerSubscriptionId: "sub_1",
      provider: "STRIPE",
      plan: "STARTER",
      status: "ACTIVE",
    });
    config.get.mockImplementation((key: string) => {
      if (key === "stripe.prices.PRO") return "price_pro";
      return undefined;
    });
    await expect(service.changePlan(context, "PRO")).resolves.toMatchObject({
      accepted: true,
      pendingWebhook: true,
      plan: "PRO",
    });
    expect(provider.updateSubscription).toHaveBeenCalledWith({
      subscriptionId: "sub_1",
      priceId: "price_pro",
      plan: "PRO",
    });
    expect(billing.updatePendingPlan).toHaveBeenCalledWith("sub-local", "PRO");
  });

  it("limits a free pause request to the validated resume date", async () => {
    billing.currentSubscription.mockResolvedValue({
      id: "sub-local",
      providerSubscriptionId: "sub_1",
      provider: "STRIPE",
      plan: "PRO",
      status: "ACTIVE",
      pausedAt: null,
    });
    await expect(service.pause(context, 30)).resolves.toMatchObject({
      accepted: true,
      pendingWebhook: true,
    });
    expect(provider.pauseSubscription).toHaveBeenCalledWith("sub_1", expect.any(Date));
  });

  it("permits a paid extra phone number when recurring add-on pricing is configured", async () => {
    gates.resolve.mockResolvedValue({
      allowed: true,
      source: "SUBSCRIPTION",
      limits: { phoneNumbers: 1 },
    });
    billing.activePhoneNumberInventory.mockResolvedValue({ total: 1, purchased: 1 });
    billing.currentSubscription.mockResolvedValue({ id: "sub-local", status: "ACTIVE" });
    config.get.mockImplementation((key: string) =>
      key === "stripe.prices.PHONE_NUMBER" ? "price_phone" : undefined,
    );

    await expect(service.assertPhoneNumberPurchase("org-1")).resolves.toMatchObject({
      included: false,
      owned: 1,
    });
  });

  it("does not allow an unbilled extra number during a no-card trial", async () => {
    gates.resolve.mockResolvedValue({
      allowed: true,
      source: "TRIAL",
      limits: { phoneNumbers: 1 },
    });
    billing.activePhoneNumberInventory.mockResolvedValue({ total: 1, purchased: 1 });
    billing.currentSubscription.mockResolvedValue(null);

    await expect(service.assertPhoneNumberPurchase("org-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
