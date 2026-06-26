import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { RecordingService } from "../recording/recording.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { AudioPacketService } from "./audio-packet.service";
import type {
  MediaStreamConnectionState,
  TwilioMediaStreamEvent,
  TwilioStartEvent,
  TwilioStopEvent,
} from "./media-stream.types";
import { StreamLifecycleService } from "./stream-lifecycle.service";

@Injectable()
export class MediaStreamService {
  private readonly logger = new Logger(MediaStreamService.name);
  private readonly connections = new Map<string, MediaStreamConnectionState>();

  constructor(
    private readonly lifecycle: StreamLifecycleService,
    private readonly audioPackets: AudioPacketService,
    private readonly realtime: RealtimeGateway,
    private readonly recordings: RecordingService,
  ) {}

  registerConnection(connectionId: string) {
    this.connections.set(connectionId, {
      connectionId,
      connectedAt: new Date(),
    });
  }

  async handleEvent(
    connectionId: string,
    event: unknown,
    sendToTwilio?: (event: Record<string, unknown>) => boolean,
    closeTwilio?: () => void,
  ) {
    const parsed = parseTwilioEvent(event);
    switch (parsed.event) {
      case "connected":
        this.registerConnection(connectionId);
        return { ok: true };
      case "start":
        return this.handleStart(connectionId, parsed, sendToTwilio, closeTwilio);
      case "media":
        return this.handleMedia(parsed);
      case "dtmf":
      case "mark":
        return { ok: true };
      case "stop":
        return this.handleStop(connectionId, parsed);
      default:
        return assertNever(parsed);
    }
  }

  async handleDisconnect(connectionId: string) {
    const connection = this.connections.get(connectionId);
    this.connections.delete(connectionId);
    if (connection?.streamSid) {
      await Promise.all([
        this.realtime.stop(connection.streamSid),
        this.stopRecording(connection.streamSid),
        this.lifecycle.disconnect(connection.streamSid),
      ]);
    }
  }

  private async handleStart(
    connectionId: string,
    event: TwilioStartEvent,
    sendToTwilio?: (event: Record<string, unknown>) => boolean,
    closeTwilio?: () => void,
  ) {
    const session = await this.lifecycle.start(event);
    if (!sendToTwilio || !closeTwilio) {
      throw new BadRequestException("Twilio media sender is unavailable.");
    }
    this.connections.set(connectionId, {
      connectionId,
      connectedAt: new Date(),
      streamSid: event.start.streamSid,
      twilioCallSid: event.start.callSid,
    });
    void this.recordings.startForSession(session).catch((error) => {
      this.logger.warn(`Recording startup failed: ${readError(error)}`);
    });
    await this.realtime.start({
      streamSid: event.start.streamSid,
      callSid: event.start.callSid,
      sendToTwilio,
      closeTwilio,
    });
    this.logger.debug("Twilio media stream started.");
    return session;
  }

  private async handleMedia(event: Extract<TwilioMediaStreamEvent, { event: "media" }>) {
    const result = this.audioPackets.process(event);
    if (event.media.payload) {
      this.realtime.media(event.streamSid, event.media.payload);
    }
    return result;
  }

  private async handleStop(connectionId: string, event: TwilioStopEvent) {
    const [result] = await Promise.all([
      this.lifecycle.stop(event),
      this.realtime.stop(event.streamSid),
      this.stopRecording(event.streamSid),
    ]);
    this.connections.delete(connectionId);
    return result;
  }

  private async stopRecording(streamSid: string) {
    try {
      return await this.recordings.stopForStream(streamSid);
    } catch (error) {
      this.logger.warn(`Recording stop failed: ${readError(error)}`);
      return null;
    }
  }
}

function parseTwilioEvent(event: unknown): TwilioMediaStreamEvent {
  if (!event || typeof event !== "object" || !("event" in event)) {
    throw new BadRequestException("Malformed Twilio media event.");
  }

  const candidate = event as { event?: unknown };
  if (
    candidate.event !== "connected" &&
    candidate.event !== "start" &&
    candidate.event !== "media" &&
    candidate.event !== "dtmf" &&
    candidate.event !== "mark" &&
    candidate.event !== "stop"
  ) {
    throw new BadRequestException("Unsupported Twilio media event.");
  }

  return event as TwilioMediaStreamEvent;
}

function assertNever(value: never): never {
  throw new BadRequestException(`Unhandled Twilio media event: ${JSON.stringify(value)}`);
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
