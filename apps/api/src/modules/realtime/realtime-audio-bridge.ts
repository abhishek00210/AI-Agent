import { Injectable, Logger } from "@nestjs/common";
import { RealtimeConnectionManager } from "./realtime-connection-manager";
import { RealtimeSessionService } from "./realtime-session.service";
import { RecordingBufferService } from "../recording/recording-buffer.service";

@Injectable()
export class RealtimeAudioBridge {
  private readonly logger = new Logger(RealtimeAudioBridge.name);

  constructor(
    private readonly connections: RealtimeConnectionManager,
    private readonly sessions: RealtimeSessionService,
    private readonly recordings: RecordingBufferService,
  ) {}

  forwardTwilioAudio(input: { streamSid: string; realtimeSessionId: string; payload: string }) {
    if (this.connections.sendAudio(input.streamSid, input.payload)) {
      this.sessions.recordAudioSent(input.realtimeSessionId);
    }
    this.recordings.capture(input.streamSid, input.payload);
  }

  forwardOpenAiAudio(input: {
    streamSid: string;
    realtimeSessionId: string;
    payload: string;
    sendToTwilio: (event: Record<string, unknown>) => boolean;
  }) {
    const accepted = input.sendToTwilio({
      event: "media",
      streamSid: input.streamSid,
      media: {
        payload: input.payload,
      },
    });
    if (accepted) {
      this.recordings.capture(input.streamSid, input.payload);
      this.sessions.recordAudioReceived(input.realtimeSessionId);
    } else {
      this.logger.warn("Dropping stale OpenAI audio due to Twilio backpressure.");
    }
  }
}
