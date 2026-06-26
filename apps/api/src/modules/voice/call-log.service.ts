import { Injectable, NotFoundException } from "@nestjs/common";
import type { TenantContext } from "../tenant/tenant.service";
import type { ListCallsQueryDto } from "./dto/call.dto";
import { CallSearchService } from "./call-search.service";
import { toCallResponse } from "./call.service";
import { CallRepository } from "./repositories/call.repository";

export interface CallTimelineEvent {
  id: string;
  type:
    | "CALL_CREATED"
    | "CALL_ANSWERED"
    | "REALTIME_CONNECTED"
    | "RECORDING_STARTED"
    | "RECORDING_COMPLETED"
    | "TRANSCRIPT_COMPLETED"
    | "CONVERSATION_COMPLETED"
    | "CALL_ENDED";
  title: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

@Injectable()
export class CallLogService {
  constructor(
    private readonly calls: CallRepository,
    private readonly search: CallSearchService,
  ) {}

  async list(context: TenantContext, query: ListCallsQueryDto) {
    const options = this.search.toRepositoryOptions(context.organizationId, query);
    const result = await this.calls.list(options);
    return {
      total: result.total,
      page: options.page,
      limit: options.limit,
      nextCursor: result.nextCursor,
      data: result.data.map(toCallResponse),
    };
  }

  async getById(context: TenantContext, callId: string) {
    const call = await this.calls.findById(context.organizationId, callId);
    if (!call) {
      throw new NotFoundException("Call not found.");
    }
    await this.calls.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: "call.viewed",
      entityType: "Call",
      entityId: callId,
    });
    return toCallResponse(call);
  }

  async timeline(context: TenantContext, callId: string) {
    const call = await this.calls.findTimelineById(context.organizationId, callId);
    if (!call) {
      throw new NotFoundException("Call not found.");
    }
    return {
      callId: call.id,
      events: buildTimeline(call),
    };
  }
}

function buildTimeline(call: NonNullable<Awaited<ReturnType<CallRepository["findTimelineById"]>>>) {
  const events: CallTimelineEvent[] = [
    {
      id: `${call.id}:created`,
      type: "CALL_CREATED",
      title: "Call created",
      occurredAt: call.startedAt,
      metadata: { status: call.status },
    },
  ];

  if (call.answeredAt) {
    events.push({
      id: `${call.id}:answered`,
      type: "CALL_ANSWERED",
      title: "Call answered",
      occurredAt: call.answeredAt,
      metadata: {},
    });
  }

  for (const session of call.realtimeSessions) {
    if (session.connectedAt) {
      events.push({
        id: `${session.id}:realtime-connected`,
        type: "REALTIME_CONNECTED",
        title: "Realtime session connected",
        occurredAt: session.connectedAt,
        metadata: {
          sessionId: session.id,
          openAiSessionId: session.openAiSessionId,
          status: session.status,
        },
      });
    }
  }

  for (const recording of call.recordings) {
    if (recording.recordingStartedAt) {
      events.push({
        id: `${recording.id}:recording-started`,
        type: "RECORDING_STARTED",
        title: "Recording started",
        occurredAt: recording.recordingStartedAt,
        metadata: { recordingId: recording.id, status: recording.status },
      });
    }
    if (recording.recordingCompletedAt) {
      events.push({
        id: `${recording.id}:recording-completed`,
        type: "RECORDING_COMPLETED",
        title: "Recording completed",
        occurredAt: recording.recordingCompletedAt,
        metadata: { recordingId: recording.id, status: recording.status },
      });
    }
  }

  for (const transcript of call.transcripts) {
    if (transcript.completedAt) {
      events.push({
        id: `${transcript.id}:transcript-completed`,
        type: "TRANSCRIPT_COMPLETED",
        title: "Transcript completed",
        occurredAt: transcript.completedAt,
        metadata: { transcriptId: transcript.id, status: transcript.status },
      });
    }
  }

  if (call.conversation?.endedAt) {
    events.push({
      id: `${call.conversation.id}:conversation-completed`,
      type: "CONVERSATION_COMPLETED",
      title: "Conversation completed",
      occurredAt: call.conversation.endedAt,
      metadata: { conversationId: call.conversation.id, status: call.conversation.status },
    });
  }

  if (call.endedAt) {
    events.push({
      id: `${call.id}:ended`,
      type: "CALL_ENDED",
      title: "Call ended",
      occurredAt: call.endedAt,
      metadata: { status: call.status },
    });
  }

  return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
