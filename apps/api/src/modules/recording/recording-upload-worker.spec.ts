import { RecordingUploadWorker } from "./recording-upload-worker";

describe("RecordingUploadWorker", () => {
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  };
  const recordings = {
    markProcessing: jest.fn().mockResolvedValue({ count: 1 }),
    markAvailable: jest.fn().mockResolvedValue({ fileSizeBytes: 364, isOutbound: false }),
    markFailed: jest.fn().mockResolvedValue(undefined),
    createAuditEvent: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    finalizeAndUpload: jest.fn(),
  };
  const transcription = {
    enqueueForRecording: jest.fn().mockResolvedValue(true),
  };
  const usage = { increment: jest.fn().mockResolvedValue(undefined) };
  const job = {
    recordingId: "recording-1",
    organizationId: "org-1",
    callId: "call-1",
    callSessionId: "session-1",
    twilioCallSid: "CA123",
    rawPath: "/tmp/recording.ulaw",
    startedAt: "2026-06-15T00:00:00.000Z",
    receivedBytes: 160,
    droppedBytes: 0,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries local fallback uploads and eventually marks the recording available", async () => {
    storage.finalizeAndUpload
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce({
        storageProvider: "s3-compatible",
        storagePath: "organizations/org-1/calls/call-1/recordings/recording-1.wav",
        durationSeconds: 1,
        fileSizeBytes: 364,
      });
    const worker = new RecordingUploadWorker(
      config as never,
      recordings as never,
      storage as never,
      transcription as never,
      usage as never,
    );
    worker.onModuleInit();

    await worker.enqueueFinalize(job);
    await jest.runAllTimersAsync();

    expect(storage.finalizeAndUpload).toHaveBeenCalledTimes(3);
    expect(recordings.markFailed).toHaveBeenCalledTimes(2);
    expect(recordings.markAvailable).toHaveBeenCalledTimes(1);
    expect(transcription.enqueueForRecording).toHaveBeenCalledWith("org-1", "recording-1");
  });
});
