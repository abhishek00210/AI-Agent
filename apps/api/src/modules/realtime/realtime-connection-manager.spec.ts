import WebSocket from "ws";
import { RealtimeConnectionManager } from "./realtime-connection-manager";

describe("RealtimeConnectionManager audio backpressure", () => {
  it("drops stale caller audio before an OpenAI socket buffer can grow unbounded", () => {
    const metrics = { increment: jest.fn() };
    const manager = new RealtimeConnectionManager(
      {
        get: jest.fn((key: string) =>
          key === "openai.realtimeMaxBufferedAudioBytes" ? 1024 : 100,
        ),
      } as never,
      metrics as never,
    );
    const socket = {
      readyState: WebSocket.OPEN,
      bufferedAmount: 2048,
      send: jest.fn(),
    };
    (manager as unknown as {
      connections: Map<string, { socket: unknown; pendingAudioPackets: number }>;
    }).connections.set("MZ123", { socket, pendingAudioPackets: 0 });

    expect(manager.sendAudio("MZ123", "audio")).toBe(false);
    expect(socket.send).not.toHaveBeenCalled();
    expect(metrics.increment).toHaveBeenCalledWith("dropped_audio_frames");
    expect(metrics.increment).toHaveBeenCalledWith("backpressure_events");
  });
});
