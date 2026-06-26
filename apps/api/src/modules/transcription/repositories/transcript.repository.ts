import { Injectable } from "@nestjs/common";
import { Prisma, type SpeakerType, type TranscriptStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";
import type { StructuredTranscriptSegment } from "../transcription.types";

export interface TranscriptListOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: TranscriptStatus;
  callId?: string;
  agentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class TranscriptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPendingForRecording(organizationId: string, recordingId: string) {
    const recording = await this.prisma.callRecording.findFirst({
      where: { id: recordingId, organizationId, status: "AVAILABLE" },
      select: {
        id: true,
        callId: true,
        call: {
          select: {
            realtimeSessions: {
              where: { organizationId, conversationId: { not: null } },
              select: { conversationId: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!recording) {
      return null;
    }

    return this.prisma.callTranscript.upsert({
      where: { callRecordingId: recording.id },
      create: {
        organizationId,
        callId: recording.callId,
        callRecordingId: recording.id,
        conversationId: recording.call.realtimeSessions[0]?.conversationId ?? null,
        status: "PENDING",
      },
      update: {
        conversationId: recording.call.realtimeSessions[0]?.conversationId ?? undefined,
        status: "PENDING",
        failureReason: null,
        startedAt: null,
        completedAt: null,
      },
    });
  }

  markProcessing(organizationId: string, transcriptId: string) {
    return this.prisma.callTranscript.updateMany({
      where: { id: transcriptId, organizationId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING", startedAt: new Date(), failureReason: null },
    });
  }

  processingContext(organizationId: string, transcriptId: string) {
    return this.prisma.callTranscript.findFirst({
      where: { id: transcriptId, organizationId },
      select: {
        id: true,
        organizationId: true,
        callId: true,
        conversationId: true,
        callRecording: {
          select: {
            id: true,
            fileName: true,
            storagePath: true,
            status: true,
            durationSeconds: true,
          },
        },
        call: {
          select: {
            startedAt: true,
            callerNumber: true,
            calledNumber: true,
            agent: { select: { id: true, name: true, language: true } },
          },
        },
        conversation: {
          select: {
            messages: {
              where: { deletedAt: null, messageType: "TEXT" },
              select: {
                senderType: true,
                content: true,
                createdAt: true,
                metadata: true,
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
  }

  async complete(
    organizationId: string,
    transcriptId: string,
    input: {
      language?: string;
      provider: string;
      durationSeconds?: number;
      fullText: string;
      wordCount: number;
      confidence?: number;
      summary?: string;
      processingTimeMs: number;
      segments: StructuredTranscriptSegment[];
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.callTranscriptSegment.deleteMany({ where: { transcriptId } });
      if (input.segments.length > 0) {
        await tx.callTranscriptSegment.createMany({
          data: input.segments.map((segment) => ({
            transcriptId,
            speaker: segment.speaker,
            startMs: segment.startMs,
            endMs: segment.endMs,
            text: segment.text,
            confidence: segment.confidence,
            sequence: segment.sequence,
          })),
        });
      }
      const transcript = await tx.callTranscript.update({
        where: { id: transcriptId, organizationId },
        data: {
          status: "COMPLETED",
          language: input.language,
          provider: input.provider,
          durationSeconds: input.durationSeconds,
          fullText: input.fullText,
          wordCount: input.wordCount,
          confidence: input.confidence,
          summary: input.summary,
          processingTimeMs: input.processingTimeMs,
          completedAt: new Date(),
          failureReason: null,
        },
        include: this.defaultInclude(),
      });
      await tx.call.updateMany({
        where: { id: transcript.callId, organizationId },
        data: {
          callTranscriptId: transcript.id,
          ...(transcript.conversationId ? { conversationId: transcript.conversationId } : {}),
        },
      });
      const outbound = await tx.outboundCall.updateMany({
        where: { callId: transcript.callId, organizationId },
        data: { transcriptId: transcript.id },
      });
      return { ...transcript, isOutbound: outbound.count > 0 };
    });
  }

  markFailed(organizationId: string, transcriptId: string, reason: string) {
    return this.prisma.callTranscript.updateMany({
      where: { id: transcriptId, organizationId },
      data: {
        status: "FAILED",
        failureReason: reason.slice(0, 2000),
        completedAt: new Date(),
      },
    });
  }

  findById(organizationId: string, transcriptId: string) {
    return this.prisma.callTranscript.findFirst({
      where: { id: transcriptId, organizationId },
      include: this.defaultInclude(),
    });
  }

  findByCallId(organizationId: string, callId: string) {
    return this.prisma.callTranscript.findFirst({
      where: { callId, organizationId },
      include: this.defaultInclude(),
      orderBy: { createdAt: "desc" },
    });
  }

  listSegments(organizationId: string, transcriptId: string) {
    return this.prisma.callTranscriptSegment.findMany({
      where: { transcriptId, transcript: { organizationId } },
      orderBy: { sequence: "asc" },
    });
  }

  async list(options: TranscriptListOptions) {
    const searchIds = options.search
      ? await this.fullTextSearchIds(options.organizationId, options.search)
      : undefined;
    const where = this.buildScopedWhere(options, searchIds);
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.callTranscript.count({ where }),
      this.prisma.callTranscript.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take: options.limit,
      }),
    ]);
    return { total, data };
  }

  async stats(organizationId: string) {
    const [total, completed, processing, failed, confidence] = await Promise.all([
      this.prisma.callTranscript.count({ where: { organizationId } }),
      this.prisma.callTranscript.count({ where: { organizationId, status: "COMPLETED" } }),
      this.prisma.callTranscript.count({ where: { organizationId, status: "PROCESSING" } }),
      this.prisma.callTranscript.count({ where: { organizationId, status: "FAILED" } }),
      this.prisma.callTranscript.aggregate({
        where: { organizationId, status: "COMPLETED", confidence: { not: null } },
        _avg: { confidence: true },
      }),
    ]);
    return {
      totalTranscripts: total,
      completedTranscripts: completed,
      processingTranscripts: processing,
      failedTranscripts: failed,
      averageTranscriptConfidence: confidence._avg.confidence ?? null,
    };
  }

  createAuditEvent(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }

  private async fullTextSearchIds(organizationId: string, search: string): Promise<string[]> {
    const matches = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT transcript."id"
      FROM "call_transcripts" transcript
      INNER JOIN "calls" call ON call."id" = transcript."callId"
      INNER JOIN "agents" agent ON agent."id" = call."agentId"
      WHERE transcript."organizationId" = ${organizationId}
        AND (
          to_tsvector(
            'simple',
            coalesce(transcript."fullText", '') || ' ' || coalesce(transcript."summary", '')
          ) @@ websearch_to_tsquery('simple', ${search})
          OR call."id" ILIKE ${`%${search}%`}
          OR call."twilioCallSid" ILIKE ${`%${search}%`}
          OR call."callerNumber" ILIKE ${`%${search}%`}
          OR call."calledNumber" ILIKE ${`%${search}%`}
          OR agent."name" ILIKE ${`%${search}%`}
        )
      ORDER BY ts_rank(
        to_tsvector(
          'simple',
          coalesce(transcript."fullText", '') || ' ' || coalesce(transcript."summary", '')
        ),
        websearch_to_tsquery('simple', ${search})
      ) DESC, transcript."createdAt" DESC
      LIMIT 2000
    `);
    return matches.map((match) => match.id);
  }

  private buildScopedWhere(
    options: TranscriptListOptions,
    searchIds?: string[],
  ): Prisma.CallTranscriptWhereInput {
    return {
      organizationId: options.organizationId,
      ...(searchIds ? { id: { in: searchIds } } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.callId ? { callId: options.callId } : {}),
      ...(options.agentId ? { call: { agentId: options.agentId } } : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            createdAt: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
    };
  }

  private defaultInclude() {
    return {
      call: {
        select: {
          id: true,
          callerNumber: true,
          calledNumber: true,
          startedAt: true,
          agent: { select: { id: true, name: true, status: true } },
        },
      },
      callRecording: {
        select: { id: true, fileName: true, status: true, durationSeconds: true },
      },
      _count: { select: { segments: true } },
    } satisfies Prisma.CallTranscriptInclude;
  }
}

export type TranscriptSpeaker = SpeakerType;
