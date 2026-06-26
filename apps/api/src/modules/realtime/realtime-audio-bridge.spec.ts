import { RealtimeAudioBridge } from "./realtime-audio-bridge";

describe("RealtimeAudioBridge", () => {
  const connections = {
    sendAudio: jest.fn().mockReturnValue(true),
  };
  const sessions = {
    recordAudioSent: jest.fn(),
    recordAudioReceived: jest.fn(),
  };
  const recordings = {
    capture: jest.fn(),
  };
  const bridge = new RealtimeAudioBridge(
    connections as never,
    sessions as never,
    recordings as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards Twilio PCMU payloads to OpenAI before recording the caller audio", () => {
    bridge.forwardTwilioAudio({
      streamSid: "MZ123",
      realtimeSessionId: "realtime-1",
      payload: "base64-audio",
    });

    expect(connections.sendAudio).toHaveBeenCalledWith("MZ123", "base64-audio");
    expect(recordings.capture).toHaveBeenCalledWith("MZ123", "base64-audio");
    expect(sessions.recordAudioSent).toHaveBeenCalledWith("realtime-1");
    expect(connections.sendAudio.mock.invocationCallOrder[0]).toBeLessThan(
      recordings.capture.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("forwards OpenAI PCMU payloads to the matching Twilio stream and records assistant audio", () => {
    const sendToTwilio = jest.fn().mockReturnValue(true);

    bridge.forwardOpenAiAudio({
      streamSid: "MZ123",
      realtimeSessionId: "realtime-1",
      payload: "base64-response",
      sendToTwilio,
    });

    expect(sendToTwilio).toHaveBeenCalledWith({
      event: "media",
      streamSid: "MZ123",
      media: { payload: "base64-response" },
    });
    expect(recordings.capture).toHaveBeenCalledWith("MZ123", "base64-response");
    expect(sessions.recordAudioReceived).toHaveBeenCalledWith("realtime-1");
    expect(sendToTwilio.mock.invocationCallOrder[0]).toBeLessThan(
      recordings.capture.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("drops audio metrics when either transport applies backpressure", () => {
    connections.sendAudio.mockReturnValueOnce(false);
    const sendToTwilio = jest.fn().mockReturnValue(false);

    bridge.forwardTwilioAudio({
      streamSid: "MZ123",
      realtimeSessionId: "realtime-1",
      payload: "stale-input",
    });
    bridge.forwardOpenAiAudio({
      streamSid: "MZ123",
      realtimeSessionId: "realtime-1",
      payload: "stale-output",
      sendToTwilio,
    });

    expect(sessions.recordAudioSent).not.toHaveBeenCalled();
    expect(sessions.recordAudioReceived).not.toHaveBeenCalled();
    expect(recordings.capture).toHaveBeenCalledWith("MZ123", "stale-input");
    expect(recordings.capture).not.toHaveBeenCalledWith("MZ123", "stale-output");
  });
});
