import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { MediaStreamService } from "./media-stream.service";
import { TwilioSignatureService } from "../twilio/twilio-signature.service";
import { ExotelSignatureService } from "../telephony/exotel-signature.service";

const TWILIO_MEDIA_PATH = "/ws/twilio-media";
const EXOTEL_MEDIA_PATH = "/ws/exotel-media";
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_WEBSOCKET_FRAME_BYTES = 128 * 1024;
const MAX_WEBSOCKET_BUFFER_BYTES = 256 * 1024;

@Injectable()
export class MediaStreamGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaStreamGateway.name);
  private readonly sockets = new Map<string, Socket>();
  private readonly pendingAudioPackets = new Map<string, number>();
  private httpServer?: NodeHttpServer;
  private readonly upgradeListener: UpgradeListener = (request, socket, head) => {
    void this.handleUpgrade(request, socket, head);
  };

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly mediaStreams: MediaStreamService,
    private readonly config: ConfigService,
    private readonly signatures: TwilioSignatureService,
    private readonly exotelSignatures: ExotelSignatureService,
  ) {}

  onModuleInit() {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer() as NodeHttpServer;
    this.httpServer = httpServer;
    httpServer.on("upgrade", this.upgradeListener);
    this.logger.log(`Telephony media stream WebSocket ready at ${TWILIO_MEDIA_PATH} and ${EXOTEL_MEDIA_PATH}`);
  }

  onModuleDestroy() {
    this.httpServer?.off?.("upgrade", this.upgradeListener);
    for (const socket of this.sockets.values()) {
      socket.destroy();
    }
    this.sockets.clear();
    this.pendingAudioPackets.clear();
  }

  private async handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
    const provider = mediaProviderForPath(request.url);
    if (!provider) {
      return;
    }

    if (!isAllowedOrigin(request.headers.origin, provider)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    if (!this.validateMediaUpgrade(provider, request)) {
      this.logger.warn(`Rejected unauthenticated ${provider} media WebSocket upgrade.`);
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const websocketKey = request.headers["sec-websocket-key"];
    if (typeof websocketKey !== "string" || !websocketKey.trim()) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const connectionId = randomUUID();
    this.sockets.set(connectionId, socket);
    this.mediaStreams.registerConnection(connectionId);
    socket.write(createHandshakeResponse(websocketKey));

    let buffer: Buffer<ArrayBufferLike> = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
    let frameQueue = Promise.resolve();
    let finalized = false;

    const enqueueFrame = (frame: WebSocketFrame) => {
      frameQueue = frameQueue.then(() => this.handleFrame(connectionId, socket, frame, provider));
    };

    const finalize = () => {
      if (finalized) {
        return;
      }
      finalized = true;
      this.sockets.delete(connectionId);
      this.pendingAudioPackets.delete(connectionId);
      void frameQueue.finally(() => this.mediaStreams.handleDisconnect(connectionId));
    };

    socket.on("data", (chunk) => {
      try {
        if (buffer.length + chunk.length > MAX_WEBSOCKET_BUFFER_BYTES) {
          throw new Error("WebSocket input buffer exceeded.");
        }
        buffer = Buffer.concat([buffer, chunk]);
        const result = extractFrames(buffer);
        buffer = result.remaining;
        for (const frame of result.frames) {
          enqueueFrame(frame);
        }
      } catch (error) {
        this.logger.warn(`Closing malformed ${provider} media socket: ${readError(error)}`);
        socket.destroy();
      }
    });

    socket.on("close", finalize);

    socket.on("error", (error) => {
      this.logger.warn(`${provider} media socket error: ${error.message}`);
      finalize();
    });
  }

  private validateMediaUpgrade(provider: "TWILIO" | "EXOTEL", request: IncomingMessage): boolean {
    if (provider === "EXOTEL") {
      const token = new URL(request.url ?? "", "http://localhost").searchParams.get("token");
      return this.exotelSignatures.validateStreamToken(token);
    }
    const signatureHeader = request.headers["x-twilio-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    return this.signatures.validateRequest({
      url: this.mediaStreamUrl("TWILIO"),
      params: {},
      signature,
    });
  }

  private mediaStreamUrl(provider: "TWILIO" | "EXOTEL"): string {
    const baseUrl = this.config
      .getOrThrow<string>("voice.webhookBaseUrl")
      .replace(/\/$/, "")
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
    return `${baseUrl}${provider === "EXOTEL" ? EXOTEL_MEDIA_PATH : TWILIO_MEDIA_PATH}`;
  }

  private async handleFrame(
    connectionId: string,
    socket: Socket,
    frame: WebSocketFrame,
    provider: "TWILIO" | "EXOTEL",
  ) {
    if (frame.opcode === 0x8) {
      socket.end(encodeFrame(Buffer.alloc(0), 0x8));
      return;
    }

    if (frame.opcode === 0x9) {
      socket.write(encodeFrame(frame.payload, 0xa));
      return;
    }

    if (frame.opcode !== 0x1) {
      return;
    }

    try {
      const event = JSON.parse(frame.payload.toString("utf8")) as unknown;
      const normalizedEvent =
        provider === "EXOTEL" ? normalizeExotelMediaEvent(event, connectionId) : event;
      await this.mediaStreams.handleEvent(
        connectionId,
        normalizedEvent,
        (outboundEvent) => this.writeOutboundEvent(connectionId, socket, outboundEvent, provider),
        () => socket.end(encodeFrame(Buffer.alloc(0), 0x8)),
      );
    } catch (error) {
      this.logger.warn(`Invalid ${provider} media frame: ${readError(error)}`);
      socket.write(encodeFrame(Buffer.from(JSON.stringify({ error: "Invalid media frame" })), 0x1));
      socket.end(encodeFrame(Buffer.alloc(0), 0x8));
    }
  }

  private writeOutboundEvent(
    connectionId: string,
    socket: Socket,
    event: Record<string, unknown>,
    provider: "TWILIO" | "EXOTEL" = "TWILIO",
  ): boolean {
    if (!socket.writable) {
      return false;
    }

    const isAudio = event.event === "media";
    const pending = this.pendingAudioPackets.get(connectionId) ?? 0;
    const maxPackets = this.config.get<number>("openai.realtimeMaxBufferedAudioPackets") ?? 100;
    const maxBytes = this.config.get<number>("openai.realtimeMaxBufferedAudioBytes") ?? 65_536;
    if (isAudio && (pending >= maxPackets || socket.writableLength >= maxBytes)) {
      this.logger.warn(`Dropping stale OpenAI audio due to ${provider} backpressure.`);
      return false;
    }

    if (isAudio) {
      this.pendingAudioPackets.set(connectionId, pending + 1);
    }
    const payloadEvent = provider === "EXOTEL" ? toExotelOutboundEvent(event) : event;
    socket.write(encodeFrame(Buffer.from(JSON.stringify(payloadEvent)), 0x1), () => {
      if (isAudio) {
        this.pendingAudioPackets.set(
          connectionId,
          Math.max(0, (this.pendingAudioPackets.get(connectionId) ?? 1) - 1),
        );
      }
    });
    return true;
  }
}

type UpgradeListener = (request: IncomingMessage, socket: Socket, head: Buffer) => void;
type NodeHttpServer = {
  on: (event: string, listener: UpgradeListener) => void;
  off?: (event: string, listener: UpgradeListener) => void;
};

interface WebSocketFrame {
  opcode: number;
  payload: Buffer<ArrayBufferLike>;
}

function mediaProviderForPath(url?: string): "TWILIO" | "EXOTEL" | null {
  if (!url) {
    return null;
  }

  const path = url.split("?")[0];
  if (path === TWILIO_MEDIA_PATH) return "TWILIO";
  if (path === EXOTEL_MEDIA_PATH) return "EXOTEL";
  return null;
}

function isAllowedOrigin(origin: string | undefined, provider: "TWILIO" | "EXOTEL"): boolean {
  if (!origin) {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".twilio.com") ||
      (provider === "EXOTEL" && hostname.endsWith(".exotel.com"))
    );
  } catch {
    return false;
  }
}

function normalizeExotelMediaEvent(event: unknown, connectionId: string): Record<string, unknown> {
  if (!event || typeof event !== "object") return {};
  const source = event as Record<string, unknown>;
  const eventName = stringFrom(source.event ?? source.Event ?? source.type) ?? "";
  if (eventName === "connected") return { event: "connected" };
  if (eventName === "start") {
    const start = recordFrom(source.start) ?? source;
    const streamSid =
      stringFrom(start.streamSid ?? start.stream_sid ?? source.streamSid ?? source.stream_sid) ??
      connectionId;
    const callSid =
      stringFrom(start.callSid ?? start.call_sid ?? start.CallSid ?? source.CallSid ?? source.call_sid) ??
      streamSid;
    return {
      event: "start",
      sequenceNumber: stringFrom(source.sequenceNumber ?? source.sequence_number) ?? "1",
      streamSid,
      start: {
        streamSid,
        callSid,
        tracks: ["inbound"],
        mediaFormat: {
          encoding: "audio/pcmu",
          sampleRate: 8000,
          channels: 1,
        },
      },
    };
  }
  if (eventName === "media") {
    const media = recordFrom(source.media) ?? source;
    const payload = stringFrom(media.payload);
    return {
      event: "media",
      sequenceNumber: stringFrom(source.sequenceNumber ?? source.sequence_number) ?? "1",
      streamSid:
        stringFrom(source.streamSid ?? source.stream_sid ?? media.streamSid ?? media.stream_sid) ??
        connectionId,
      media: {
        track: "inbound",
        chunk: stringFrom(media.chunk) ?? "1",
        timestamp: stringFrom(media.timestamp) ?? String(Date.now()),
        payload: payload ? pcm16leBase64ToPcmuBase64(payload) : "",
      },
    };
  }
  if (eventName === "dtmf") return { event: "dtmf", streamSid: connectionId };
  if (eventName === "stop") {
    return {
      event: "stop",
      sequenceNumber: stringFrom(source.sequenceNumber ?? source.sequence_number) ?? "1",
      streamSid: stringFrom(source.streamSid ?? source.stream_sid) ?? connectionId,
      stop: {},
    };
  }
  return { event: eventName };
}

function toExotelOutboundEvent(event: Record<string, unknown>): Record<string, unknown> {
  if (event.event !== "media") return event;
  const media = recordFrom(event.media);
  const payload = stringFrom(media?.payload);
  return {
    event: "media",
    media: {
      payload: payload ? pcmuBase64ToPcm16leBase64(payload) : "",
    },
  };
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringFrom(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function pcm16leBase64ToPcmuBase64(payload: string): string {
  const input = Buffer.from(payload, "base64");
  const output = Buffer.alloc(Math.floor(input.length / 2));
  for (let offset = 0; offset + 1 < input.length; offset += 2) {
    output[offset / 2] = linear16ToUlaw(input.readInt16LE(offset));
  }
  return output.toString("base64");
}

function pcmuBase64ToPcm16leBase64(payload: string): string {
  const input = Buffer.from(payload, "base64");
  const output = Buffer.alloc(input.length * 2);
  for (let index = 0; index < input.length; index += 1) {
    output.writeInt16LE(ulawToLinear16(input[index]), index * 2);
  }
  return output.toString("base64");
}

function linear16ToUlaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  const sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
    exponent -= 1;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function ulawToLinear16(value: number): number {
  const sample = ~value & 0xff;
  const sign = sample & 0x80;
  const exponent = (sample >> 4) & 0x07;
  const mantissa = sample & 0x0f;
  let decoded = ((mantissa << 3) + 0x84) << exponent;
  decoded -= 0x84;
  return sign ? -decoded : decoded;
}

function createHandshakeResponse(websocketKey: string): string {
  const accept = createHash("sha1").update(`${websocketKey}${WEBSOCKET_GUID}`).digest("base64");

  return [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n",
  ].join("\r\n");
}

function extractFrames(buffer: Buffer<ArrayBufferLike>): {
  frames: WebSocketFrame[];
  remaining: Buffer<ArrayBufferLike>;
} {
  const frames: WebSocketFrame[] = [];
  let offset = 0;

  while (buffer.length - offset >= 2) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (buffer.length - offset < 4) {
        break;
      }
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (buffer.length - offset < 10) {
        break;
      }
      const longLength = buffer.readBigUInt64BE(offset + 2);
      if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("WebSocket payload too large.");
      }
      payloadLength = Number(longLength);
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    if (payloadLength > MAX_WEBSOCKET_FRAME_BYTES) {
      throw new Error("WebSocket frame exceeded.");
    }
    const frameLength = headerLength + maskLength + payloadLength;
    if (buffer.length - offset < frameLength) {
      break;
    }

    const mask = masked ? buffer.subarray(offset + headerLength, offset + headerLength + 4) : null;
    const payloadStart = offset + headerLength + maskLength;
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLength));

    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }

    frames.push({ opcode, payload });
    offset += frameLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset),
  };
}

function encodeFrame(payload: Buffer<ArrayBufferLike>, opcode: number): Buffer<ArrayBufferLike> {
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
  }

  const header = Buffer.alloc(4);
  header[0] = 0x80 | opcode;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
