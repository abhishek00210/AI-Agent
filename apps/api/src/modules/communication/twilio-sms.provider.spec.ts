import { TwilioSMSProvider } from "./twilio-sms.provider";

describe("TwilioSMSProvider", () => {
  it("routes SMS through the platform telephony provider", async () => {
    const sendSms = jest.fn().mockResolvedValue({
      provider: "TWILIO",
      providerMessageId: "SM123",
      status: "queued",
    });
    const telephony = {
      resolve: jest.fn(() => ({ sendSms })),
    };
    const locales = {
      getOrganizationLocale: jest.fn().mockResolvedValue({
        country: "CA",
        telephonyProvider: "TWILIO",
      }),
    };
    const provider = new TwilioSMSProvider(telephony as never, locales as never);

    const input = {
      organizationId: "org-1",
      to: "+14165550100",
      from: "+14165550999",
      body: "Hello",
      statusCallbackUrl: "https://agent.example.com/status",
    };
    const result = await provider.send(input);

    expect(telephony.resolve).toHaveBeenCalledWith({
      organizationCountry: "CA",
      provider: "TWILIO",
    });
    expect(sendSms).toHaveBeenCalledWith(input);
    expect(result).toEqual({ provider: "TWILIO", providerMessageId: "SM123", status: "queued" });
  });
});
