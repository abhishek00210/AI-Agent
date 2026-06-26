import { createHmac } from "node:crypto";
import { RazorpayProvider } from "./razorpay.provider";

describe("RazorpayProvider", () => {
  const config = {
    get: jest.fn((key: string) =>
      ({
        "razorpay.keyId": "rzp_test",
        "razorpay.keySecret": "secret",
        "razorpay.webhookSecret": "whsec",
      })[key],
    ),
  };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({}) as never);
  });

  afterEach(() => fetchSpy.mockRestore());

  it("creates customers with GST metadata without exposing secrets", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ id: "cust_1", email: "owner@example.com", name: "Acme India" }) as never,
    );
    const provider = new RazorpayProvider(config as never);

    await expect(
      provider.createCustomer({
        organizationId: "org-1",
        email: "owner@example.com",
        name: "Acme India",
        gstNumber: "29ABCDE1234F1Z5",
      }),
    ).resolves.toEqual({
      id: "cust_1",
      email: "owner@example.com",
      name: "Acme India",
      provider: "RAZORPAY",
    });
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(String(init?.body)).toContain("gstin");
    expect(String(init?.headers?.Authorization)).toMatch(/^Basic /);
  });

  it("creates a hosted subscription checkout link", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ id: "sub_1", short_url: "https://rzp.io/i/test" }) as never,
    );
    const provider = new RazorpayProvider(config as never);

    await expect(
      provider.createCheckoutSession({
        organizationId: "org-1",
        customerId: "cust_1",
        priceId: "plan_starter",
        plan: "STARTER",
        successUrl: "https://agent.zodo.ca/billing?checkout=complete",
        cancelUrl: "https://agent.zodo.ca/billing?checkout=cancelled",
      }),
    ).resolves.toEqual({
      id: "sub_1",
      url: "https://rzp.io/i/test",
      provider: "RAZORPAY",
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/v1/subscriptions");
  });

  it("verifies and normalizes Razorpay subscription webhooks", () => {
    const provider = new RazorpayProvider(config as never);
    const payload = Buffer.from(
      JSON.stringify({
        event: "subscription.activated",
        id: "evt_1",
        payload: {
          subscription: {
            entity: {
              id: "sub_1",
              customer_id: "cust_1",
              plan_id: "plan_starter",
              status: "active",
              current_start: 1780000000,
              current_end: 1782592000,
              notes: { organizationId: "org-1", plan: "STARTER" },
            },
          },
        },
      }),
    );
    const signature = createHmac("sha256", "whsec").update(payload).digest("hex");

    expect(provider.verifyWebhook(payload, signature)).toMatchObject({
      id: "evt_1",
      type: "customer.subscription.updated",
      provider: "RAZORPAY",
      customerId: "cust_1",
      subscriptionId: "sub_1",
      subscription: expect.objectContaining({
        id: "sub_1",
        status: "ACTIVE",
        plan: "STARTER",
      }),
    });
  });

  it("creates refund requests", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ id: "rfnd_1", payment_id: "pay_1", amount: 5000, currency: "INR", status: "processed" }) as never,
    );
    const provider = new RazorpayProvider(config as never);
    await expect(provider.refundPayment({ paymentId: "pay_1", amountCents: 5000 })).resolves.toEqual({
      id: "rfnd_1",
      paymentId: "pay_1",
      amountCents: 5000,
      currency: "INR",
      status: "processed",
      provider: "RAZORPAY",
    });
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}
