import { TwiMLResponseService } from "./twiml-response.service";

describe("TwiMLResponseService", () => {
  const service = new TwiMLResponseService({
    mediaStreamUrl: jest.fn(() => "wss://api.example.com/ws/twilio-media"),
  } as never);

  it("generates Twilio-compatible routing XML", () => {
    expect(service.routing()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://api.example.com/ws/twilio-media" /></Connect></Response>',
    );
    expect(service.routing()).not.toContain("<Say>");
  });

  it("generates a graceful unavailable response", () => {
    expect(service.unavailable()).toContain(
      "<Say>We are unable to take your call at the moment.</Say>",
    );
  });
});
