import { Readable } from "node:stream";
import { RecordingStorageService } from "./recording-storage.service";

describe("RecordingStorageService", () => {
  const storage = {
    upload: jest.fn(),
  };
  const writer = {
    finalizeMulawToWav: jest.fn(),
    createReadStream: jest.fn(),
    cleanup: jest.fn(),
  };
  const service = new RecordingStorageService(storage as never, writer as never);
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
    jest.clearAllMocks();
    writer.finalizeMulawToWav.mockResolvedValue({
      wavPath: "/tmp/recording.wav",
      segmentPaths: ["/tmp/recording.ulaw.part-000000"],
      durationSeconds: 1,
      fileSizeBytes: 364,
      rawBytes: 160,
    });
    writer.createReadStream.mockReturnValue(Readable.from(Buffer.alloc(364)));
  });

  it("retains raw segments and WAV output when object storage upload fails", async () => {
    storage.upload.mockRejectedValue(new Error("S3 unavailable"));

    await expect(service.finalizeAndUpload(job)).rejects.toThrow("S3 unavailable");

    expect(writer.cleanup).not.toHaveBeenCalled();
  });

  it("cleans temporary artifacts only after storage upload succeeds", async () => {
    storage.upload.mockResolvedValue({
      key: "organizations/org-1/calls/call-1/recordings/recording-1.wav",
      provider: "s3-compatible",
      bucket: "private",
    });

    await expect(service.finalizeAndUpload(job)).resolves.toMatchObject({
      storageProvider: "s3-compatible",
      durationSeconds: 1,
      fileSizeBytes: 364,
    });

    expect(writer.cleanup).toHaveBeenCalledWith([
      "/tmp/recording.ulaw",
      "/tmp/recording.ulaw.part-000000",
      "/tmp/recording.wav",
    ]);
  });
});
