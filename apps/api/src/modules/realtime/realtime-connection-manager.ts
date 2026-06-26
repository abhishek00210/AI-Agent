import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import WebSocket from "ws";
import type { OpenAiRealtimeEvent } from "./realtime.types";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";

interface ManagedRealtimeConnection {
  socket: WebSocket;
  pendingAudioPackets: number;
}

@Injectable()
export class RealtimeConnectionManager {
  private readonly logger = new Logger(RealtimeConnectionManager.name);
  private readonly connections = new Map<string, ManagedRealtimeConnection>();
  private hasConnectedBefore = false;

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  connect(
    streamSid: string,
    onEvent: (event: OpenAiRealtimeEvent) => void | Promise<void>,
    onClose: (reason: string) => void | Promise<void>,
    onFailure: (reason: string) => void | Promise<void>,
    safetyIdentifier: string,
  ): Promise<{ cold: boolean }> {
    const apiKey = this.config.get<string>("openai.apiKey");
    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API key is not configured.");
    }

    const model = this.config.get<string>("openai.realtimeModel") ?? "gpt-realtime-2";
    const socket = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Safety-Identifier": safetyIdentifier,
        },
      },
    );
    const connectStartedAt = this.metrics.now();
    const cold = !this.hasConnectedBefore;

    return new Promise((resolve, reject) => {
      let opened = false;
      const timeout = setTimeout(() => {
        socket.terminate();
        reject(new ServiceUnavailableException("OpenAI Realtime connection timed out."));
      }, 10_000);

      socket.once("open", () => {
        opened = true;
        clearTimeout(timeout);
        this.connections.set(streamSid, { socket, pendingAudioPackets: 0 });
        this.metrics.observe("openai_connect_ms", connectStartedAt);
        this.metrics.observe(
          cold ? "openai_connect_cold_ms" : "openai_connect_warm_ms",
          connectStartedAt,
        );
        this.hasConnectedBefore = true;
        this.metrics.increment("active_calls");
        resolve({ cold });
      });

      socket.on("message", (data) => {
        try {
          const event = JSON.parse(data.toString()) as OpenAiRealtimeEvent;
          void Promise.resolve(onEvent(event)).catch((error: unknown) => {
            const reason = `OpenAI event processing failed: ${readError(error)}`;
            this.logger.error(reason);
            void onFailure(reason);
            socket.close(1011, "Realtime event processing failed.");
          });
        } catch (error) {
          this.logger.warn(`Invalid OpenAI Realtime event: ${readError(error)}`);
        }
      });

      socket.once("error", (error) => {
        clearTimeout(timeout);
        if (socket.readyState !== WebSocket.OPEN) {
          this.metrics.observe("openai_connect_ms", connectStartedAt, false);
          reject(new ServiceUnavailableException("OpenAI Realtime connection failed."));
        }
        this.logger.error(`OpenAI Realtime socket error: ${error.message}`);
      });

      socket.once("close", (_code, reason) => {
        clearTimeout(timeout);
        this.connections.delete(streamSid);
        if (opened) {
          this.metrics.increment("active_calls", -1);
        }
        this.metrics.increment("openai_disconnects");
        void onClose(reason.toString() || "OpenAI socket closed.");
      });
    });
  }

  send(streamSid: string, event: Record<string, unknown>) {
    const connection = this.connections.get(streamSid);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      throw new ServiceUnavailableException("OpenAI Realtime session is not connected.");
    }
    connection.socket.send(JSON.stringify(event));
  }

  sendAudio(streamSid: string, payload: string): boolean {
    const connection = this.connections.get(streamSid);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const maxPackets = this.config.get<number>("openai.realtimeMaxBufferedAudioPackets") ?? 100;
    const maxBytes = this.config.get<number>("openai.realtimeMaxBufferedAudioBytes") ?? 65_536;
    if (
      connection.pendingAudioPackets >= maxPackets ||
      connection.socket.bufferedAmount >= maxBytes
    ) {
      this.logger.warn("Dropping stale Twilio audio due to realtime backpressure.");
      this.metrics.increment("dropped_audio_frames");
      this.metrics.increment("backpressure_events");
      return false;
    }

    connection.pendingAudioPackets += 1;
    connection.socket.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: payload,
      }),
      () => {
        connection.pendingAudioPackets = Math.max(0, connection.pendingAudioPackets - 1);
      },
    );
    return true;
  }

  close(streamSid: string) {
    const connection = this.connections.get(streamSid);
    this.connections.delete(streamSid);
    if (
      connection &&
      (connection.socket.readyState === WebSocket.OPEN ||
        connection.socket.readyState === WebSocket.CONNECTING)
    ) {
      connection.socket.close(1000, "Twilio media stream ended.");
    }
  }

  has(streamSid: string) {
    return this.connections.has(streamSid);
  }
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
