import { TwilioProvider } from "./twilio.provider";

describe("TwilioProvider", () => {
  const twilio = {
    isConfigured: jest.fn(() => true),
    validateConnection: jest.fn(),
    startOutboundCall: jest.fn(),
    sendSms: jest.fn(),
    removeNumber: jest.fn(),
  };
  const metrics = { now: jest.fn(() => 10), increment: jest.fn() };
  const provider = new TwilioProvider(
    twilio as never,
    { get: jest.fn() } as never,
    metrics as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("maps outbound calls and SMS to provider-neutral DTOs", async () => {
    twilio.startOutboundCall.mockResolvedValue({ providerCallSid: "CA123", status: "queued" });
    twilio.sendSms.mockResolvedValue({ providerMessageId: "SM123", status: "queued" });

    await expect(
      provider.createOutboundCall({
        to: "+14165550100",
        from: "+14165550999",
        voiceUrl: "https://api.example.com/voice",
        statusCallbackUrl: "https://api.example.com/status",
      }),
    ).resolves.toEqual({ provider: "TWILIO", providerCallSid: "CA123", status: "queued" });
    await expect(
      provider.sendSms({
        to: "+14165550100",
        from: "+14165550999",
        body: "Hello",
      }),
    ).resolves.toEqual({ provider: "TWILIO", providerMessageId: "SM123", status: "queued" });
  });

  it("disables a number by clearing provider routing", async () => {
    twilio.removeNumber.mockResolvedValue(undefined);
    await provider.disableNumber("PN123");
    expect(twilio.removeNumber).toHaveBeenCalledWith("PN123");
  });
});
