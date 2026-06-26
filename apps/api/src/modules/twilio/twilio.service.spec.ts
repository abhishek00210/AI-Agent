import { TwilioService } from "./twilio.service";

describe("TwilioService call control", () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        "twilio.accountSid": "AC123",
        "twilio.authToken": "auth-token",
        "twilio.apiKey": "",
        "twilio.apiSecret": "",
      };
      return values[key];
    }),
  };
  const service = new TwilioService(config as never);

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("redirects a failed realtime call to spoken fallback TwiML and hangs up", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "CA123" }),
    } as Response);

    await service.endCallWithMessage(
      "CA123",
      "We're experiencing technical difficulties. Please try again later.",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Calls/CA123.json",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    const body = request?.body as URLSearchParams;
    expect(body.get("Twiml")).toBe(
      "<Response><Say>We&apos;re experiencing technical difficulties. Please try again later.</Say><Hangup/></Response>",
    );
  });

  it("surfaces Twilio country and regulatory purchase failures clearly", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: 21452,
        message: "Phone number requires a valid address in this country.",
      }),
    } as Response);

    await expect(
      service.purchasePhoneNumber("+442071838750", {
        voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/voice",
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        message:
          "Twilio request failed (21452): Phone number requires a valid address in this country.",
      },
    });
  });
});
