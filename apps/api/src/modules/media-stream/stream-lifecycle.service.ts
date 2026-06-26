import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { TwilioStartEvent, TwilioStopEvent } from "./media-stream.types";
import { CallSessionService } from "./call-session.service";

@Injectable()
export class StreamLifecycleService {
  private readonly logger = new Logger(StreamLifecycleService.name);

  constructor(private readonly sessions: CallSessionService) {}

  async start(event: TwilioStartEvent) {
    const streamSid = event.start?.streamSid ?? event.streamSid;
    const twilioCallSid = event.start?.callSid;

    if (!streamSid || !twilioCallSid) {
      throw new BadRequestException("Stream SID and Call SID are required.");
    }

    return this.sessions.start({
      streamSid,
      twilioCallSid,
      metadata: {
        sequenceNumber: event.sequenceNumber ?? null,
        tracks: event.start.tracks ?? [],
        mediaFormat: event.start.mediaFormat ?? null,
      },
    });
  }

  async stop(event: TwilioStopEvent) {
    if (!event.streamSid) {
      throw new BadRequestException("Stream SID is required to stop a media session.");
    }

    try {
      return await this.sessions.stop(event.streamSid);
    } catch (error) {
      this.logger.warn(`Unable to stop unknown media stream: ${readError(error)}`);
      return null;
    }
  }

  async disconnect(streamSid?: string) {
    if (!streamSid) {
      return null;
    }

    try {
      return await this.sessions.stop(streamSid);
    } catch (error) {
      this.logger.warn(`Unable to close disconnected media stream: ${readError(error)}`);
      return null;
    }
  }
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
