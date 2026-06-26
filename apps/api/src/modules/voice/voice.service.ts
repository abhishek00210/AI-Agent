import { Injectable } from "@nestjs/common";
import { CallSessionService } from "../media-stream/call-session.service";
import { RealtimeSessionService } from "../realtime/realtime-session.service";
import { RecordingService } from "../recording/recording.service";
import { TranscriptionService } from "../transcription/transcription.service";
import type { TenantContext } from "../tenant/tenant.service";
import { CallService } from "./call.service";
import { PhoneNumberService } from "./phone-number.service";

@Injectable()
export class VoiceService {
  constructor(
    private readonly phoneNumbers: PhoneNumberService,
    private readonly calls: CallService,
    private readonly sessions: CallSessionService,
    private readonly realtimeSessions: RealtimeSessionService,
    private readonly recordings: RecordingService,
    private readonly transcripts: TranscriptionService,
  ) {}

  capabilities() {
    return {
      resource: "voice",
      realtime: "openai-structure-ready",
      telephony: "twilio-phone-number-management-ready",
    };
  }

  async dashboard(context: TenantContext) {
    const [
      phoneNumberStats,
      callStats,
      streamStats,
      realtimeStats,
      recordingStats,
      transcriptStats,
    ] = await Promise.all([
      this.phoneNumbers.analytics(context),
      this.calls.stats(context),
      this.sessions.stats(context),
      this.realtimeSessions.stats(context),
      this.recordings.stats(context),
      this.transcripts.stats(context),
    ]);
    return {
      ...phoneNumberStats,
      totalCalls: callStats.totalCalls,
      todayCalls: callStats.todayCalls,
      failedCalls: callStats.failedCalls,
      recentCalls: callStats.recentCalls,
      ...streamStats,
      ...realtimeStats,
      ...recordingStats,
      ...transcriptStats,
      callDurationSeconds: 0,
      bookings: 0,
      leads: 0,
    };
  }
}
