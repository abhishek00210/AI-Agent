export const RECORDING_MIME_TYPE = "audio/wav";
export const RECORDING_SAMPLE_RATE = 8000;
export const RECORDING_CHANNELS = 1;
export const RECORDING_MAX_BUFFER_BYTES = 5 * 1024 * 1024;
export const RECORDING_SEGMENT_BYTES = 16 * 1024 * 1024;
export const RECORDING_MAX_DURATION_SECONDS = 4 * 60 * 60;
export const RECORDING_MAX_RAW_BYTES =
  RECORDING_SAMPLE_RATE * RECORDING_CHANNELS * RECORDING_MAX_DURATION_SECONDS;
export const RECORDING_UPLOAD_ATTEMPTS = 3;

export interface RecordingSessionContext {
  recordingId: string;
  organizationId: string;
  callId: string;
  callSessionId: string;
  twilioCallSid: string;
  streamSid: string;
  rawPath: string;
  startedAt: string;
}

export interface FinalizeRecordingJob {
  recordingId: string;
  organizationId: string;
  callId: string;
  callSessionId: string;
  twilioCallSid: string;
  rawPath: string;
  startedAt: string;
  receivedBytes: number;
  droppedBytes: number;
}
