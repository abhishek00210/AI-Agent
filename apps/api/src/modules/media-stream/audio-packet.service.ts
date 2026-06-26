import { BadRequestException, Injectable } from "@nestjs/common";
import type { TwilioMediaEvent } from "./media-stream.types";
import { CallSessionService } from "./call-session.service";

@Injectable()
export class AudioPacketService {
  constructor(private readonly sessions: CallSessionService) {}

  process(event: TwilioMediaEvent) {
    if (!event.streamSid) {
      throw new BadRequestException("Stream SID is required for media packets.");
    }

    if (!event.media?.payload) {
      throw new BadRequestException("Media payload is required.");
    }

    if (!isBase64Audio(event.media.payload)) {
      throw new BadRequestException("Media payload must be valid base64 audio.");
    }

    return this.sessions.recordPacket(event.streamSid);
  }
}

function isBase64Audio(payload: string): boolean {
  return payload.length > 0 && payload.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(payload);
}
