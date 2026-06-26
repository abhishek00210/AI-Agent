import { BillingQueueService } from "./billing-queue.service";

describe("BillingQueueService phone-number add-ons", () => {
  it("charges only active numbers above the plan allowance", async () => {
    const deps = createDependencies();
    deps.billing.currentSubscription.mockResolvedValue({
      id: "sub-local",
      plan: "STARTER",
      status: "ACTIVE",
      provider: "STRIPE",
      providerSubscriptionId: "sub_stripe",
    });
    deps.billing.activePhoneNumberInventory.mockResolvedValue({ total: 3, purchased: 3 });
    deps.provider.syncSubscriptionAddon.mockResolvedValue({
      subscriptionItemId: "si_phone",
      unitAmountCents: 499,
      currency: "CAD",
    });
    const service = createService(deps);

    await service.syncPhoneNumberAddon("org-1");

    expect(deps.provider.syncSubscriptionAddon).toHaveBeenCalledWith({
      subscriptionId: "sub_stripe",
      priceId: "price_phone",
      quantity: 2,
    });
    expect(deps.billing.upsertPhoneNumberAddon).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", quantity: 2, unitAmountCents: 499 }),
    );
  });

  it("removes the Stripe add-on when no extra numbers remain", async () => {
    const deps = createDependencies();
    deps.billing.currentSubscription.mockResolvedValue({
      id: "sub-local",
      plan: "PRO",
      status: "ACTIVE",
      provider: "STRIPE",
      providerSubscriptionId: "sub_stripe",
    });
    deps.billing.activePhoneNumberInventory.mockResolvedValue({ total: 1, purchased: 1 });
    deps.provider.syncSubscriptionAddon.mockResolvedValue({
      subscriptionItemId: null,
      unitAmountCents: 499,
      currency: "CAD",
    });
    const service = createService(deps);

    await service.syncPhoneNumberAddon("org-1");

    expect(deps.provider.syncSubscriptionAddon).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 0 }),
    );
  });

  it("records failures for reconciliation without losing tenant context", async () => {
    const deps = createDependencies();
    deps.billing.currentSubscription.mockResolvedValue({
      id: "sub-local",
      plan: "STARTER",
      status: "ACTIVE",
      provider: "STRIPE",
      providerSubscriptionId: "sub_stripe",
    });
    deps.billing.activePhoneNumberInventory.mockResolvedValue({ total: 2, purchased: 2 });
    deps.provider.syncSubscriptionAddon.mockRejectedValue(new Error("Stripe unavailable"));
    const service = createService(deps);

    await expect(service.syncPhoneNumberAddon("org-1")).rejects.toThrow("Stripe unavailable");
    expect(deps.billing.markPhoneNumberAddonFailed).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", error: "Stripe unavailable" }),
    );
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new BillingQueueService(
    deps.config as never,
    deps.subscriptions as never,
    deps.billing as never,
    deps.gates as never,
    deps.payments as never,
    deps.metrics as never,
  );
}

function createDependencies() {
  const deps = {
    config: {
      get: jest.fn((key: string) =>
        key === "stripe.prices.PHONE_NUMBER" ? "price_phone" : undefined,
      ),
    },
    subscriptions: {},
    billing: {
      currentSubscription: jest.fn(),
      activePhoneNumberInventory: jest.fn(),
      upsertPhoneNumberAddon: jest.fn(),
      markPhoneNumberAddonFailed: jest.fn(),
      createAudit: jest.fn(),
    },
    gates: {},
    provider: { isConfigured: jest.fn(() => true), syncSubscriptionAddon: jest.fn() },
    payments: { byName: jest.fn() },
    metrics: {},
  };
  deps.payments.byName.mockReturnValue(deps.provider);
  return deps;
}
