import { MediaStreamService } from "./media-stream.service";

describe("MediaStreamService", () => {
  const lifecycle = {
    start: jest.fn(),
    stop: jest.fn(),
    disconnect: jest.fn(),
  };
  const audioPackets = {
    process: jest.fn(),
  };
  const realtime = {
    start: jest.fn(),
    media: jest.fn(),
    stop: jest.fn(),
  };
  const recordings = {
    startForSession: jest.fn().mockResolvedValue(null),
    stopForStream: jest.fn().mockResolvedValue(null),
  };
  const service = new MediaStreamService(
    lifecycle as never,
    audioPackets as never,
    realtime as never,
    recordings as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tracks connected events", async () => {
    await expect(service.handleEvent("conn-1", { event: "connected" })).resolves.toEqual({
      ok: true,
    });
  });

  it("starts a stream session from Twilio start events", async () => {
    lifecycle.start.mockResolvedValue({ id: "session-1" });

    await service.handleEvent(
      "conn-1",
      {
        event: "start",
        start: {
          streamSid: "MZ123",
          callSid: "CA123",
          tracks: ["inbound"],
          mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        },
      },
      jest.fn().mockReturnValue(true),
      jest.fn(),
    );

    expect(lifecycle.start).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "start",
        start: expect.objectContaining({ streamSid: "MZ123", callSid: "CA123" }),
      }),
    );
    expect(realtime.start).toHaveBeenCalledWith(
      expect.objectContaining({ streamSid: "MZ123", callSid: "CA123" }),
    );
    expect(recordings.startForSession).toHaveBeenCalledWith({ id: "session-1" });
  });

  it("processes media packets", async () => {
    audioPackets.process.mockResolvedValue({ packetCount: 1 });

    await service.handleEvent("conn-1", {
      event: "media",
      streamSid: "MZ123",
      media: {
        payload: "base64-audio",
        track: "inbound",
        timestamp: "10",
      },
    });

    expect(audioPackets.process).toHaveBeenCalledWith(
      expect.objectContaining({ event: "media", streamSid: "MZ123" }),
    );
    expect(realtime.media).toHaveBeenCalledWith("MZ123", "base64-audio");
  });

  it("never forwards a malformed media packet to OpenAI", async () => {
    audioPackets.process.mockImplementation(() => {
      throw new Error("Media payload must be valid base64 audio.");
    });

    await expect(
      service.handleEvent("conn-1", {
        event: "media",
        streamSid: "MZ123",
        media: { payload: "not-base64!", track: "inbound", timestamp: "10" },
      }),
    ).rejects.toThrow("valid base64");

    expect(realtime.media).not.toHaveBeenCalled();
  });

  it("ignores Twilio dtmf control events without closing the stream", async () => {
    await expect(
      service.handleEvent("conn-1", {
        event: "dtmf",
        streamSid: "MZ123",
        dtmf: { track: "inbound_track", digit: "1" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(audioPackets.process).not.toHaveBeenCalled();
    expect(realtime.media).not.toHaveBeenCalled();
    expect(realtime.stop).not.toHaveBeenCalled();
  });

  it("ignores Twilio mark control events without closing the stream", async () => {
    await expect(
      service.handleEvent("conn-1", {
        event: "mark",
        streamSid: "MZ123",
        mark: { name: "assistant-audio" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(audioPackets.process).not.toHaveBeenCalled();
    expect(realtime.media).not.toHaveBeenCalled();
    expect(realtime.stop).not.toHaveBeenCalled();
  });

  it("closes stream sessions on stop events", async () => {
    lifecycle.stop.mockResolvedValue({ id: "session-1" });

    await service.handleEvent("conn-1", {
      event: "stop",
      streamSid: "MZ123",
      stop: { callSid: "CA123" },
    });

    expect(lifecycle.stop).toHaveBeenCalledWith(
      expect.objectContaining({ event: "stop", streamSid: "MZ123" }),
    );
    expect(realtime.stop).toHaveBeenCalledWith("MZ123");
    expect(recordings.stopForStream).toHaveBeenCalledWith("MZ123");
  });

  it("finalizes recording when the Twilio socket disconnects unexpectedly", async () => {
    lifecycle.start.mockResolvedValue({
      id: "session-1",
      streamSid: "MZ123",
      callId: "call-1",
      organizationId: "org-1",
      twilioCallSid: "CA123",
    });

    await service.handleEvent(
      "conn-disconnect",
      {
        event: "start",
        start: {
          streamSid: "MZ123",
          callSid: "CA123",
          tracks: ["inbound"],
          mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
        },
      },
      jest.fn().mockReturnValue(true),
      jest.fn(),
    );

    await service.handleDisconnect("conn-disconnect");

    expect(recordings.stopForStream).toHaveBeenCalledWith("MZ123");
    expect(realtime.stop).toHaveBeenCalledWith("MZ123");
    expect(lifecycle.disconnect).toHaveBeenCalledWith("MZ123");
  });
});
