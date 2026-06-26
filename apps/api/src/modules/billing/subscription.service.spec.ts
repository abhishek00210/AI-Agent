import { BadRequestException } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import type { WebhookEvent } from "../payments/providers/payment-provider.interface";

describe("SubscriptionService", () => {
  const billing = {
    reserveEvent: jest.fn(),
    findCustomerByProviderId: jest.fn(),
    findSubscriptionByProviderId: jest.fn(),
    processReservedEvent: jest.fn(),
    upsertSubscription: jest.fn(),
    updateOrganizationPlan: jest.fn(),
    auditInTransaction: jest.fn(),
    findEvent: jest.fn(),
  };
  const config = { get: jest.fn() };
  const payments = { byName: jest.fn(() => ({ getSubscription: jest.fn() })) };
  const service = new SubscriptionService(billing as never, config as never, payments as never);

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === "stripe.prices.PHONE_NUMBER") return "price_phone";
      if (key === "stripe.prices") {
        return {
          STARTER: "price_starter",
          PRO: "price_pro",
          AGENCY: "price_agency",
          PHONE_NUMBER: "price_phone",
        };
      }
      return undefined;
    });
    billing.reserveEvent.mockResolvedValue({ processed: false });
    billing.findCustomerByProviderId.mockResolvedValue({ id: "bc-1", organizationId: "org-1" });
    billing.findSubscriptionByProviderId.mockResolvedValue(null);
    billing.upsertSubscription.mockResolvedValue({ id: "local-sub" });
    billing.processReservedEvent.mockImplementation(async (_id, _provider, handler) => {
      await handler({}, { id: "local-event", organizationId: "org-1", processed: false });
      return { duplicate: false };
    });
  });

  it("atomically upgrades the organization plan from a verified subscription event", async () => {
    await service.processVerifiedEvent(subscriptionEvent("evt_up", "active", "price_pro"), "org-1");
    expect(billing.upsertSubscription).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ plan: "PRO", status: "ACTIVE" }),
    );
    expect(billing.updateOrganizationPlan).toHaveBeenCalledWith({}, "org-1", "PRO");
  });

  it("downgrades to FREE only when the verified subscription is no longer active", async () => {
    await service.processVerifiedEvent(
      subscriptionEvent("evt_cancel", "canceled", "price_pro"),
      "org-1",
    );
    expect(billing.updateOrganizationPlan).toHaveBeenCalledWith({}, "org-1", "FREE");
  });

  it("does not process the state mutation when the event is already complete", async () => {
    billing.processReservedEvent.mockResolvedValue({ duplicate: true });
    await expect(
      service.processVerifiedEvent(
        subscriptionEvent("evt_duplicate", "active", "price_pro"),
        "org-1",
      ),
    ).resolves.toEqual({ duplicate: true });
    expect(billing.upsertSubscription).not.toHaveBeenCalled();
  });

  it("rejects a Stripe customer mapped to a different tenant", async () => {
    billing.findCustomerByProviderId.mockResolvedValue({ id: "bc-2", organizationId: "org-2" });
    await expect(
      service.processVerifiedEvent(
        subscriptionEvent("evt_cross_tenant", "active", "price_pro"),
        "org-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(billing.upsertSubscription).not.toHaveBeenCalled();
  });

  it("uses the base plan item when a phone-number add-on is first in the Stripe payload", async () => {
    const event = subscriptionEvent("evt_addon", "active", "price_pro");
    event.subscription?.items.unshift({
      priceId: "price_phone",
      currentPeriodStart: new Date(1_781_000_000 * 1000),
      currentPeriodEnd: new Date(1_783_592_000 * 1000),
    });

    await service.processVerifiedEvent(event, "org-1");

    expect(billing.upsertSubscription).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ plan: "PRO", providerPriceId: "price_pro" }),
    );
  });
});

function subscriptionEvent(id: string, status: string, priceId: string) {
  return {
    id,
    type: "customer.subscription.updated",
    provider: "STRIPE",
    created: 1_781_000_000,
    customerId: "cus_1",
    subscriptionId: "sub_1",
    subscription: {
      id: "sub_1",
      provider: "STRIPE",
      customerId: "cus_1",
      status: normalizeTestStatus(status),
      currentPeriodStart: new Date(1_781_000_000 * 1000),
      currentPeriodEnd: new Date(1_783_592_000 * 1000),
      cancelAtPeriodEnd: false,
      collectionMethod: "charge_automatically",
      latestInvoiceId: "in_1",
      items: [
        {
          priceId,
          currentPeriodStart: new Date(1_781_000_000 * 1000),
          currentPeriodEnd: new Date(1_783_592_000 * 1000),
        },
      ],
    },
    payload: {},
  } satisfies WebhookEvent;
}

function normalizeTestStatus(status: string) {
  if (status === "active") return "ACTIVE";
  if (status === "canceled") return "CANCELED";
  return "INCOMPLETE";
}
