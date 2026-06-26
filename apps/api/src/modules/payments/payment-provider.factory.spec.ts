import { PaymentProviderFactory } from "./payment-provider.factory";

describe("PaymentProviderFactory", () => {
  const stripe = { name: "STRIPE" };
  const razorpay = { name: "RAZORPAY" };

  it("resolves Canada to Stripe and India to Razorpay by default", () => {
    const config = { get: jest.fn(() => undefined) };
    const factory = new PaymentProviderFactory(config as never, stripe as never, razorpay as never);

    expect(factory.resolve({ organizationCountry: "CA" })).toBe(stripe);
    expect(factory.resolve({ organizationCountry: "IN" })).toBe(razorpay);
  });

  it("honors explicit provider and country configuration overrides", () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === "payments.providers.IN") return "STRIPE";
        if (key === "payments.defaultProvider") return "RAZORPAY";
        return undefined;
      }),
    };
    const factory = new PaymentProviderFactory(config as never, stripe as never, razorpay as never);

    expect(factory.resolve({ organizationCountry: "IN" })).toBe(stripe);
    expect(factory.resolve({ provider: "RAZORPAY", organizationCountry: "CA" })).toBe(razorpay);
    expect(factory.resolve({ organizationCountry: "GB" })).toBe(razorpay);
  });
});
