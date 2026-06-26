import { MediaStreamGateway } from "./media-stream.gateway";

describe("MediaStreamGateway security", () => {
  const mediaStreams = { registerConnection: jest.fn() };
  const config = {
    getOrThrow: jest.fn().mockReturnValue("https://agent-api.example.com"),
  };
  const exotelSignatures = {
    validateStreamToken: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => jest.clearAllMocks());

  it("rejects an invalid Twilio signature before upgrading the socket", async () => {
    const signatures = { validateRequest: jest.fn().mockReturnValue(false) };
    const gateway = new MediaStreamGateway(
      {} as never,
      mediaStreams as never,
      config as never,
      signatures as never,
      exotelSignatures as never,
    );
    const socket = {
      write: jest.fn(),
      destroy: jest.fn(),
    };

    await (
      gateway as unknown as {
        handleUpgrade: (request: unknown, socket: unknown, head: Buffer) => Promise<void>;
      }
    ).handleUpgrade(
      {
        url: "/ws/twilio-media",
        headers: {
          "sec-websocket-key": "websocket-key",
          "x-twilio-signature": "invalid",
        },
      },
      socket,
      Buffer.alloc(0),
    );

    expect(signatures.validateRequest).toHaveBeenCalledWith({
      url: "wss://agent-api.example.com/ws/twilio-media",
      params: {},
      signature: "invalid",
    });
    expect(socket.write).toHaveBeenCalledWith("HTTP/1.1 403 Forbidden\r\n\r\n");
    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(mediaStreams.registerConnection).not.toHaveBeenCalled();
  });

  it("drops stale outbound audio when the Twilio socket is backpressured", () => {
    const gateway = new MediaStreamGateway(
      {} as never,
      mediaStreams as never,
      {
        get: jest.fn((key: string) =>
          key === "openai.realtimeMaxBufferedAudioBytes" ? 1024 : 100,
        ),
      } as never,
      {} as never,
      exotelSignatures as never,
    );
    const socket = { writable: true, writableLength: 2048, write: jest.fn() };

    const accepted = (
      gateway as unknown as {
        writeOutboundEvent: (
          connectionId: string,
          socket: unknown,
          event: Record<string, unknown>,
        ) => boolean;
      }
    ).writeOutboundEvent("connection-1", socket, {
      event: "media",
      streamSid: "MZ123",
      media: { payload: "audio" },
    });

    expect(accepted).toBe(false);
    expect(socket.write).not.toHaveBeenCalled();
  });
});
