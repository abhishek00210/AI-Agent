import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { StripeWebhookService } from "./stripe-webhook.service";

describe("StripeWebhookService", () => {
  const event = {
    id: "evt_1",
    type: "customer.subscription.updated",
    provider: "STRIPE",
    customerId: "cus_1",
    subscriptionId: "sub_1",
    payload: {},
  };
  const provider = { verifyWebhook: jest.fn() };
  const payments = { byName: jest.fn(() => provider) };
  const billing = {
    findCustomerByProviderId: jest.fn(),
    findSubscriptionByProviderId: jest.fn(),
  };
  const subscriptions = { supports: jest.fn(() => true), processVerifiedEvent: jest.fn() };
  const queue = { enqueue: jest.fn() };
  const service = new StripeWebhookService(
    payments as never,
    billing as never,
    subscriptions as never,
    queue as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("rejects missing and invalid signatures", async () => {
    await expect(service.handle(Buffer.from("{}"))).rejects.toBeInstanceOf(ForbiddenException);
    provider.verifyWebhook.mockImplementation(() => {
      throw new Error("bad signature");
    });
    await expect(service.handle(Buffer.from("{}"), "bad")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("derives the tenant from the stored Stripe customer and reports duplicates", async () => {
    provider.verifyWebhook.mockReturnValue(event);
    billing.findCustomerByProviderId.mockResolvedValue({ organizationId: "org-1" });
    subscriptions.processVerifiedEvent.mockResolvedValue({ duplicate: true });
    await expect(service.handle(Buffer.from("{}"), "sig")).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(subscriptions.processVerifiedEvent).toHaveBeenCalledWith(event, "org-1");
  });

  it("rejects an event that cannot be mapped to a tenant", async () => {
    provider.verifyWebhook.mockReturnValue(event);
    billing.findCustomerByProviderId.mockResolvedValue(null);
    billing.findSubscriptionByProviderId.mockResolvedValue(null);
    await expect(service.handle(Buffer.from("{}"), "sig")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
