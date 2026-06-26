import { VoiceWebhookUrlService } from "./voice-webhook-url.service";

describe("VoiceWebhookUrlService", () => {
  it("generates webhook URLs from environment config", () => {
    const service = new VoiceWebhookUrlService({
      getOrThrow: jest.fn(() => "https://api.example.com/"),
    } as never);

    expect(service.voiceUrl()).toBe("https://api.example.com/api/v1/webhooks/twilio/voice");
    expect(service.smsUrl()).toBe("https://api.example.com/api/v1/webhooks/twilio/sms/inbound");
    expect(service.mediaStreamUrl()).toBe("wss://api.example.com/ws/twilio-media");
  });

  it("generates local WebSocket URLs from HTTP base URLs", () => {
    const service = new VoiceWebhookUrlService({
      getOrThrow: jest.fn(() => "http://localhost:4000"),
    } as never);

    expect(service.mediaStreamUrl()).toBe("ws://localhost:4000/ws/twilio-media");
  });
});
