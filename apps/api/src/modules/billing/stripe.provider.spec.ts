import Stripe from "stripe";
import { StripeProvider } from "../payments/providers/stripe.provider";

describe("StripeProvider webhook verification", () => {
  const webhookSecret = "whsec_test_secret";
  const config = {
    get: jest.fn((key: string) => {
      if (key === "stripe.secretKey") return "sk_test_123";
      if (key === "stripe.webhookSecret") return webhookSecret;
      if (key === "stripe.webhookToleranceSeconds") return 300;
      return undefined;
    }),
  };
  const provider = new StripeProvider(config as never);

  it("accepts a correctly signed raw payload", () => {
    const payload = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_1", object: "invoice", amount_paid: 1000 } },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
      timestamp: Math.floor(Date.now() / 1000),
    });
    expect(provider.verifyWebhook(Buffer.from(payload), signature).id).toBe("evt_1");
  });

  it("rejects a modified payload", () => {
    const payload = JSON.stringify({ id: "evt_1", object: "event" });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
      timestamp: Math.floor(Date.now() / 1000),
    });
    expect(() => provider.verifyWebhook(Buffer.from(`${payload} `), signature)).toThrow();
  });
});
