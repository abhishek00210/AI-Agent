import { createHmac } from "node:crypto";
import { TwilioSignatureService } from "./twilio-signature.service";

describe("TwilioSignatureService", () => {
  it("validates Twilio form webhook signatures", () => {
    const config = configFixture("12345");
    const service = new TwilioSignatureService(config as never);
    const url = "https://api.example.com/api/v1/webhooks/twilio/voice";
    const params = {
      CallSid: "CA123",
      From: "+14155551234",
      To: "+15551234567",
    };

    expect(
      service.validateRequest({
        url,
        params,
        signature: sign(url, params, "12345"),
      }),
    ).toBe(true);
  });

  it("rejects missing or mismatched signatures", () => {
    const service = new TwilioSignatureService(configFixture("12345") as never);

    expect(
      service.validateRequest({
        url: "https://api.example.com/api/v1/webhooks/twilio/voice",
        params: { CallSid: "CA123" },
        signature: "invalid",
      }),
    ).toBe(false);
  });
});

function configFixture(authToken: string) {
  return {
    get: jest.fn((key: string) => (key === "twilio.authToken" ? authToken : undefined)),
  };
}

function sign(url: string, params: Record<string, string>, authToken: string) {
  const payload = Object.keys(params)
    .sort()
    .reduce((accumulator, key) => `${accumulator}${key}${params[key]}`, url);
  return createHmac("sha1", authToken).update(payload).digest("base64");
}
