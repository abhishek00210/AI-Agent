import type { SpeakerType } from "../../../generated/prisma";

export const TRANSCRIPTION_QUEUE_NAME = "call-transcription";
export const TRANSCRIPTION_DEAD_LETTER_QUEUE_NAME = "call-transcription-dead-letter";

export interface GenerateTranscriptJob {
  organizationId: string;
  transcriptId: string;
  recordingId: string;
}

export interface StructuredTranscriptSegment {
  speaker: SpeakerType;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
  sequence: number;
}
