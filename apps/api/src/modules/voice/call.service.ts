import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type { ListCallsQueryDto } from "./dto/call.dto";
import { CallAnalyticsService } from "./call-analytics.service";
import { CallSearchService } from "./call-search.service";
import { CallRepository } from "./repositories/call.repository";

@Injectable()
export class CallService {
  constructor(
    private readonly calls: CallRepository,
    private readonly search: CallSearchService,
    private readonly analytics: CallAnalyticsService,
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
    return toCallResponse(call);
  }

  async stats(context: TenantContext) {
    const stats = await this.analytics.stats(context);
    return {
      totalCalls: stats.totalCalls,
      todayCalls: stats.todayCalls,
      completedCalls: stats.completedCalls,
      failedCalls: stats.failedCalls,
      missedCalls: stats.missedCalls,
      averageDurationSeconds: stats.averageDurationSeconds,
      averageResponseTimeMs: stats.averageResponseTimeMs,
      recordingRate: stats.recordingRate,
      transcriptionRate: stats.transcriptionRate,
      statusDistribution: stats.statusDistribution,
      callsPerDay: stats.callsPerDay,
      recentCalls: stats.recentCalls.map(toCallResponse),
    };
  }
}

export function toCallResponse(call: {
  id: string;
  organizationId: string;
  agentId: string;
  phoneNumberId: string;
  conversationId?: string | null;
  callRecordingId?: string | null;
  callTranscriptId?: string | null;
  twilioCallSid: string;
  callerNumber: string;
  calledNumber: string;
  direction: string;
  status: string;
  startedAt: Date;
  answeredAt?: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  endReason?: string;
  source?: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  agent: { id: string; name: string; status: string };
  phoneNumber: { id: string; phoneNumber: string; friendlyName: string | null };
  conversation?: {
    id: string;
    status: string;
    channel: string;
    source: string;
    startedAt: Date;
    lastMessageAt: Date | null;
    endedAt: Date | null;
    _count?: { messages: number };
  } | null;
  callRecording?: {
    id: string;
    status: string;
    fileName: string;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
  } | null;
  callTranscript?: {
    id: string;
    status: string;
    language: string | null;
    wordCount: number;
    confidence: number | null;
    summary: string | null;
  } | null;
  _count?: {
    sessions: number;
    realtimeSessions: number;
    recordings: number;
    transcripts: number;
  };
}) {
  return {
    id: call.id,
    organizationId: call.organizationId,
    agentId: call.agentId,
    phoneNumberId: call.phoneNumberId,
    conversationId: call.conversationId ?? call.conversation?.id ?? null,
    callRecordingId: call.callRecordingId ?? call.callRecording?.id ?? null,
    callTranscriptId: call.callTranscriptId ?? call.callTranscript?.id ?? null,
    agent: call.agent,
    phoneNumber: call.phoneNumber,
    conversation: call.conversation
      ? {
          ...call.conversation,
          messageCount: call.conversation._count?.messages ?? 0,
        }
      : null,
    recording: call.callRecording ?? null,
    transcript: call.callTranscript ?? null,
    counts: call._count ?? {
      sessions: 0,
      realtimeSessions: 0,
      recordings: 0,
      transcripts: 0,
    },
    twilioCallSid: call.twilioCallSid,
    callerNumber: call.callerNumber,
    calledNumber: call.calledNumber,
    direction: call.direction,
    status: call.status,
    startedAt: call.startedAt,
    answeredAt: call.answeredAt ?? null,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    endReason: call.endReason ?? "UNKNOWN",
    source: call.source ?? "VOICE",
    metadata: call.metadata,
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}
