import { NotFoundException } from "@nestjs/common";
import { CallLogService } from "./call-log.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("CallLogService", () => {
  it("returns a tenant-scoped chronological timeline", async () => {
    const calls = {
      findTimelineById: jest.fn().mockResolvedValue(timelineFixture()),
      createAuditEvent: jest.fn(),
    };
    const service = new CallLogService(calls as never, { toRepositoryOptions: jest.fn() } as never);

    const result = await service.timeline(context, "call-1");

    expect(calls.findTimelineById).toHaveBeenCalledWith("org-1", "call-1");
    expect(result.events.map((event) => event.type)).toEqual([
      "CALL_CREATED",
      "CALL_ANSWERED",
      "REALTIME_CONNECTED",
      "RECORDING_STARTED",
      "RECORDING_COMPLETED",
      "TRANSCRIPT_COMPLETED",
      "CONVERSATION_COMPLETED",
      "CALL_ENDED",
    ]);
  });

  it("blocks timeline access for calls outside the tenant", async () => {
    const calls = {
      findTimelineById: jest.fn().mockResolvedValue(null),
      createAuditEvent: jest.fn(),
    };
    const service = new CallLogService(calls as never, { toRepositoryOptions: jest.fn() } as never);

    await expect(service.timeline(context, "call-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

function timelineFixture() {
  const at = (seconds: number) =>
    new Date(`2026-06-16T10:00:${String(seconds).padStart(2, "0")}.000Z`);
  return {
    id: "call-1",
    organizationId: "org-1",
    status: "COMPLETED",
    startedAt: at(0),
    answeredAt: at(1),
    endedAt: at(7),
    createdAt: at(0),
    sessions: [],
    realtimeSessions: [
      {
        id: "rt-1",
        openAiSessionId: "oa-1",
        status: "DISCONNECTED",
        connectedAt: at(2),
        disconnectedAt: at(6),
        createdAt: at(2),
      },
    ],
    recordings: [
      {
        id: "rec-1",
        status: "AVAILABLE",
        recordingStartedAt: at(3),
        recordingCompletedAt: at(4),
        createdAt: at(3),
      },
    ],
    transcripts: [
      {
        id: "tr-1",
        status: "COMPLETED",
        startedAt: at(4),
        completedAt: at(5),
        createdAt: at(4),
      },
    ],
    conversation: {
      id: "conv-1",
      status: "CLOSED",
      startedAt: at(1),
      endedAt: at(6),
      createdAt: at(1),
    },
  };
}
