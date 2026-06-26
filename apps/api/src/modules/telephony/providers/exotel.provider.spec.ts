import { ExotelProvider } from "./exotel.provider";

describe("ExotelProvider", () => {
  const metrics = { now: jest.fn(() => 10), increment: jest.fn() };
  const config = {
    get: jest.fn((key: string) =>
      ({
        "exotel.accountSid": "acc-123",
        "exotel.apiKey": "key",
        "exotel.apiToken": "token",
        "exotel.subdomain": "api.in.exotel.com",
      })[key],
    ),
  };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({}) as never);
  });

  afterEach(() => fetchSpy.mockRestore());

  it("maps available Indian ExoPhones into platform number DTOs", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        AvailablePhoneNumbers: [
          {
            sid: "exophone-1",
            phone_number: "+911139585476",
            friendly_name: "Delhi",
            region: "DL",
            capabilities: { voice: true, sms: true },
          },
        ],
      }) as never,
    );

    const provider = new ExotelProvider(config as never, metrics as never);
    await expect(provider.searchNumbers({ countryCode: "IN", areaCode: "DL", sms: true })).resolves.toEqual([
      expect.objectContaining({
        provider: "EXOTEL",
        providerSid: "exophone-1",
        phoneNumber: "+911139585476",
        region: "DL",
        capabilities: expect.objectContaining({ voice: true, sms: true }),
      }),
    ]);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      "/v2_beta/Accounts/acc-123/AvailablePhoneNumbers/IN/Landline",
    );
  });

  it("starts an outbound Voice AI call through Exotel connect", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ Call: { Sid: "exotel-call-1", Status: "queued" } }) as never,
    );

    const provider = new ExotelProvider(config as never, metrics as never);
    await expect(
      provider.createOutboundCall({
        to: "9876543210",
        from: "+911139585476",
        voiceUrl: "wss://agent-api.zodo.ca/ws/exotel-media?token=signed",
        statusCallbackUrl: "https://agent-api.zodo.ca/api/v1/webhooks/exotel/outbound-status",
      }),
    ).resolves.toEqual(expect.objectContaining({
      provider: "EXOTEL",
      providerCallSid: "exotel-call-1",
      status: "queued",
    }));
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(String(init?.body)).toContain("From=%2B919876543210");
    expect(String(init?.body)).toContain("StreamUrl=wss%3A%2F%2Fagent-api.zodo.ca%2Fws%2Fexotel-media");
  });

  it("purchases ExoPhones without sending platform webhook URLs as Exotel flow URLs", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        sid: "exo-123",
        phone_number: "+919876543210",
        friendly_name: "Zodo",
        capabilities: { voice: true, sms: true },
        country: "IN",
      }) as never,
    );

    const provider = new ExotelProvider(config as never, metrics as never);
    await expect(
      provider.purchaseNumber("+919876543210", {
        friendlyName: "Zodo",
        voiceWebhookUrl: "https://agent-api.zodo.ca/api/v1/webhooks/exotel/voice",
        smsWebhookUrl: "https://agent-api.zodo.ca/api/v1/webhooks/exotel/sms/inbound",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        provider: "EXOTEL",
        providerSid: "exo-123",
        phoneNumber: "+919876543210",
      }),
    );

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("PhoneNumber=%2B919876543210");
    expect(String(init?.body)).not.toContain("VoiceUrl=");
    expect(String(init?.body)).not.toContain("SMSUrl=");
  });

  it("uses configured Exotel Flow URLs when assigning a purchased ExoPhone", async () => {
    const flowConfig = {
      get: jest.fn((key: string) =>
        ({
          "exotel.accountSid": "acc-123",
          "exotel.apiKey": "key",
          "exotel.apiToken": "token",
          "exotel.subdomain": "api.in.exotel.com",
          "exotel.voiceFlowUrl": "https://my.exotel.com/exoml/start/voice-flow",
          "exotel.smsFlowUrl": "https://my.exotel.com/exoml/start/sms-flow",
        })[key],
      ),
    };
    fetchSpy.mockResolvedValueOnce(jsonResponse({ sid: "exo-123" }) as never);

    const provider = new ExotelProvider(flowConfig as never, metrics as never);
    await provider.assignNumber("exo-123", {
      voiceWebhookUrl: "https://agent-api.zodo.ca/api/v1/webhooks/exotel/voice",
      smsWebhookUrl: "https://agent-api.zodo.ca/api/v1/webhooks/exotel/sms/inbound",
    });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/v2_beta/Accounts/acc-123/IncomingPhoneNumbers/exo-123");
    expect(init?.method).toBe("PUT");
    expect(String(init?.body)).toContain(
      "VoiceUrl=https%3A%2F%2Fmy.exotel.com%2Fexoml%2Fstart%2Fvoice-flow",
    );
    expect(String(init?.body)).toContain(
      "SMSUrl=https%3A%2F%2Fmy.exotel.com%2Fexoml%2Fstart%2Fsms-flow",
    );
  });

  it("sends SMS through Exotel and returns a platform message DTO", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ SMSMessage: { Sid: "sms-1", Status: "queued" } }) as never,
    );

    const provider = new ExotelProvider(config as never, metrics as never);
    await expect(
      provider.sendSms({ to: "9876543210", from: "+911139585476", body: "Hello" }),
    ).resolves.toEqual({ provider: "EXOTEL", providerMessageId: "sms-1", status: "queued" });
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}
