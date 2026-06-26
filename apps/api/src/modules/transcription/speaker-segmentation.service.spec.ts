import { SpeakerSegmentationService } from "./speaker-segmentation.service";

describe("SpeakerSegmentationService", () => {
  const service = new SpeakerSegmentationService();
  const callStartedAt = new Date("2026-06-15T10:00:00.000Z");

  it("prefers persisted conversation roles to preserve USER, ASSISTANT, and SYSTEM", () => {
    const segments = service.structure({
      callStartedAt,
      transcriptionSegments: [
        { speaker: "A", startMs: 0, endMs: 1000, text: "ambiguous audio" },
      ],
      conversationMessages: [
        {
          senderType: "USER",
          content: "I need an appointment.",
          createdAt: new Date("2026-06-15T10:00:01.000Z"),
          metadata: { confidence: 0.91 },
        },
        {
          senderType: "ASSISTANT",
          content: "I can help with that.",
          createdAt: new Date("2026-06-15T10:00:03.000Z"),
          metadata: {},
        },
        {
          senderType: "SYSTEM",
          content: "Call connected.",
          createdAt: new Date("2026-06-15T10:00:04.000Z"),
          metadata: {},
        },
      ],
    });

    expect(segments.map((segment) => segment.speaker)).toEqual([
      "USER",
      "ASSISTANT",
      "SYSTEM",
    ]);
    expect(segments[0]).toMatchObject({ startMs: 1000, confidence: 0.91, sequence: 0 });
  });

  it("keeps unknown diarization labels UNKNOWN instead of guessing a role", () => {
    const segments = service.structure({
      callStartedAt,
      conversationMessages: [],
      transcriptionSegments: [
        { speaker: "A", startMs: 0, endMs: 1000, text: "Hello" },
        { speaker: "agent", startMs: 1200, endMs: 2200, text: "Welcome" },
      ],
    });

    expect(segments.map((segment) => segment.speaker)).toEqual(["UNKNOWN", "ASSISTANT"]);
  });
});
