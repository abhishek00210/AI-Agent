import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import type { ListTranscriptsQueryDto } from "./dto/transcript.dto";
import { TranscriptRepository } from "./repositories/transcript.repository";
import { TranscriptSearchService } from "./transcript-search.service";
import { TranscriptWorker } from "./transcript.worker";

@Injectable()
export class TranscriptionService {
  constructor(
    private readonly transcripts: TranscriptRepository,
    private readonly search: TranscriptSearchService,
    private readonly worker: TranscriptWorker,
  ) {}

  async list(context: TenantContext, query: ListTranscriptsQueryDto) {
    const result = await this.search.list(context.organizationId, query);
    return {
      total: result.total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      data: result.data.map(toTranscriptResponse),
    };
  }

  async getById(context: TenantContext, transcriptId: string) {
    const transcript = await this.transcripts.findById(context.organizationId, transcriptId);
    if (!transcript) throw new NotFoundException("Transcript not found.");
    await this.audit(context, "transcript.viewed", transcript.id, { callId: transcript.callId });
    return toTranscriptResponse(transcript);
  }

  async getByCallId(context: TenantContext, callId: string) {
    const transcript = await this.transcripts.findByCallId(context.organizationId, callId);
    return transcript ? toTranscriptResponse(transcript) : null;
  }

  async segments(context: TenantContext, transcriptId: string) {
    const transcript = await this.transcripts.findById(context.organizationId, transcriptId);
    if (!transcript) throw new NotFoundException("Transcript not found.");
    return this.transcripts.listSegments(context.organizationId, transcriptId);
  }

  async reprocess(context: TenantContext, transcriptId: string) {
    const transcript = await this.transcripts.findById(context.organizationId, transcriptId);
    if (!transcript) throw new NotFoundException("Transcript not found.");
    await this.worker.enqueueForRecording(
      context.organizationId,
      transcript.callRecordingId,
      true,
    );
    await this.audit(context, "transcript.reprocessed", transcript.id, {
      callId: transcript.callId,
    });
    return { success: true as const, status: "PENDING" as const };
  }

  stats(context: TenantContext) {
    return this.transcripts.stats(context.organizationId);
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.transcripts.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "CallTranscript",
      entityId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    });
  }
}

function toTranscriptResponse(transcript: {
  id: string;
  organizationId: string;
  callId: string;
  callRecordingId: string;
  conversationId: string | null;
  status: string;
  language: string | null;
  provider: string | null;
  durationSeconds: number | null;
  wordCount: number;
  confidence: number | null;
  fullText: string;
  summary: string | null;
  failureReason: string | null;
  processingTimeMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  call?: unknown;
  callRecording?: unknown;
  _count?: { segments: number };
}) {
  return {
    ...transcript,
    segmentCount: transcript._count?.segments ?? 0,
    _count: undefined,
  };
}
