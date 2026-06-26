import {
  RECORDING_MAX_BUFFER_BYTES,
  RECORDING_MAX_RAW_BYTES,
} from "./recording.types";
import { RecordingBufferService } from "./recording-buffer.service";

describe("RecordingBufferService", () => {
  const writer = {
    append: jest.fn().mockResolvedValue(undefined),
    waitForPending: jest.fn().mockResolvedValue(undefined),
  };
  let service: RecordingBufferService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecordingBufferService(writer as never);
    service.register({
      recordingId: "recording-1",
      organizationId: "org-1",
      callId: "call-1",
      callSessionId: "session-1",
      twilioCallSid: "CA123",
      streamSid: "MZ123",
      rawPath: "/tmp/recording.ulaw",
      startedAt: new Date("2026-06-09T00:00:00.000Z").toISOString(),
    });
  });

  it("does not write synchronously on audio capture", () => {
    service.capture("MZ123", Buffer.from([1, 2, 3]).toString("base64"));

    expect(writer.append).not.toHaveBeenCalled();
  });

  it("flushes buffered audio and returns a finalization job on close", async () => {
    service.capture("MZ123", Buffer.from([1, 2, 3]).toString("base64"));

    const job = await service.close("MZ123");

    expect(writer.append).toHaveBeenCalledWith("/tmp/recording.ulaw", Buffer.from([1, 2, 3]));
    expect(writer.waitForPending).toHaveBeenCalledWith("/tmp/recording.ulaw");
    expect(job).toMatchObject({
      recordingId: "recording-1",
      organizationId: "org-1",
      callId: "call-1",
      callSessionId: "session-1",
      twilioCallSid: "CA123",
      receivedBytes: 3,
      droppedBytes: 0,
    });
  });

  it("drops overflow instead of growing memory without bound", async () => {
    const payload = Buffer.alloc(RECORDING_MAX_BUFFER_BYTES + 1).toString("base64");

    service.capture("MZ123", payload);
    const job = await service.close("MZ123");

    expect(writer.append).not.toHaveBeenCalled();
    expect(job).toMatchObject({
      receivedBytes: 0,
      droppedBytes: RECORDING_MAX_BUFFER_BYTES + 1,
    });
  });

  it("caps each recording at four hours of raw 8 kHz mono audio", async () => {
    const internal = service as unknown as {
      active: Map<string, { receivedBytes: number }>;
    };
    const session = internal.active.get("MZ123");
    if (!session) {
      throw new Error("Test recording session was not registered.");
    }
    session.receivedBytes = RECORDING_MAX_RAW_BYTES - 1;

    service.capture("MZ123", Buffer.from([1, 2]).toString("base64"));
    const job = await service.close("MZ123");

    expect(writer.append).not.toHaveBeenCalled();
    expect(job).toMatchObject({
      receivedBytes: RECORDING_MAX_RAW_BYTES - 1,
      droppedBytes: 2,
    });
  });
});
