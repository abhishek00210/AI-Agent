import { TranscriptWorker } from "./transcript.worker";

describe("TranscriptWorker", () => {
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const transcripts = {
    markProcessing: jest.fn().mockResolvedValue({ count: 1 }),
    processingContext: jest.fn(),
    complete: jest.fn().mockResolvedValue({ id: "transcript-1", isOutbound: false }),
    markFailed: jest.fn().mockResolvedValue({ count: 1 }),
    createAuditEvent: jest.fn().mockResolvedValue(undefined),
    upsertPendingForRecording: jest.fn(),
  };
  const storage = { downloadToFile: jest.fn().mockResolvedValue(undefined) };
  const ai = {
    transcribeAudio: jest.fn().mockResolvedValue({
      text: "Hello",
      model: "gpt-4o-transcribe-diarize",
      language: "en",
      durationSeconds: 4,
      segments: [{ speaker: "caller", startMs: 0, endMs: 1000, text: "Hello" }],
    }),
  };
  const segmentation = {
    structure: jest.fn().mockReturnValue([
      {
        speaker: "USER",
        startMs: 0,
        endMs: 1000,
        text: "Hello",
        sequence: 0,
      },
    ]),
  };
  const summaries = { generate: jest.fn().mockResolvedValue("Caller greeted the agent.") };
  const callSummaries = { enqueueForTranscript: jest.fn().mockResolvedValue(true) };
  const usage = { increment: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    transcripts.markProcessing.mockResolvedValue({ count: 1 });
    transcripts.processingContext.mockResolvedValue({
      id: "transcript-1",
      organizationId: "org-1",
      callId: "call-1",
      conversationId: "conversation-1",
      callRecording: {
        id: "recording-1",
        fileName: "call.wav",
        storagePath: "organizations/org-1/calls/call-1/recordings/call.wav",
        status: "AVAILABLE",
        durationSeconds: 4,
      },
      call: {
        startedAt: new Date("2026-06-15T10:00:00.000Z"),
        callerNumber: "+14155550100",
        calledNumber: "+14155550200",
        agent: { id: "agent-1", name: "Receptionist", language: "English" },
      },
      conversation: { messages: [] },
    });
  });

  it("processes storage and OpenAI work only in the background worker", async () => {
    const worker = new TranscriptWorker(
      config as never,
      transcripts as never,
      storage as never,
      ai as never,
      segmentation as never,
      summaries as never,
      usage as never,
      callSummaries as never,
    );

    await worker.process({
      organizationId: "org-1",
      transcriptId: "transcript-1",
      recordingId: "recording-1",
    });

    expect(storage.downloadToFile).toHaveBeenCalledTimes(1);
    expect(ai.transcribeAudio).toHaveBeenCalledTimes(1);
    expect(transcripts.complete).toHaveBeenCalledWith(
      "org-1",
      "transcript-1",
      expect.objectContaining({
        provider: "openai:gpt-4o-transcribe-diarize",
        summary: "Caller greeted the agent.",
        wordCount: 3,
      }),
    );
    expect(callSummaries.enqueueForTranscript).toHaveBeenCalledWith("org-1", "transcript-1");
  });

  it("does no work when another worker already claimed the transcript", async () => {
    transcripts.markProcessing.mockResolvedValue({ count: 0 });
    const worker = new TranscriptWorker(
      config as never,
      transcripts as never,
      storage as never,
      ai as never,
      segmentation as never,
      summaries as never,
      usage as never,
    );

    await worker.process({
      organizationId: "org-1",
      transcriptId: "transcript-1",
      recordingId: "recording-1",
    });

    expect(storage.downloadToFile).not.toHaveBeenCalled();
    expect(ai.transcribeAudio).not.toHaveBeenCalled();
  });

  it("marks failures without losing the retry signal", async () => {
    ai.transcribeAudio.mockRejectedValueOnce(new Error("provider unavailable"));
    const worker = new TranscriptWorker(
      config as never,
      transcripts as never,
      storage as never,
      ai as never,
      segmentation as never,
      summaries as never,
      usage as never,
    );

    await expect(
      worker.process({
        organizationId: "org-1",
        transcriptId: "transcript-1",
        recordingId: "recording-1",
      }),
    ).rejects.toThrow("provider unavailable");
    expect(transcripts.markFailed).toHaveBeenCalledWith(
      "org-1",
      "transcript-1",
      "provider unavailable",
    );
  });
});
