import { Injectable, Optional } from "@nestjs/common";
import {
  Prisma,
  type CallDirection,
  type CallEndReason,
  type CallSource,
  type CallStatus,
} from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";
import { CustomerTimelineService } from "../../customer-timeline/customer-timeline.service";

export interface CallListOptions {
  organizationId: string;
  page: number;
  limit: number;
  cursor?: string;
  search?: string;
  status?: CallStatus;
  direction?: CallDirection;
  source?: CallSource;
  endReason?: CallEndReason;
  agentId?: string;
  phoneNumberId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  durationMin?: number;
  durationMax?: number;
  sortBy?: "startedAt" | "durationSeconds" | "status";
  sortOrder?: "asc" | "desc";
}

interface CallCursor {
  startedAt: string;
  id: string;
}

@Injectable()
export class CallRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly customerTimeline?: CustomerTimelineService,
  ) {}

  createInbound(input: {
    organizationId: string;
    agentId: string;
    phoneNumberId: string;
    twilioCallSid: string;
    callerNumber: string;
    calledNumber: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.call.upsert({
      where: { twilioCallSid: input.twilioCallSid },
      create: {
        ...input,
        direction: "INBOUND",
        status: "RINGING",
        source: "VOICE",
      },
      update: {
        metadata: input.metadata,
      },
      include: this.defaultInclude(),
    });
  }

  createOutbound(input: {
    organizationId: string;
    agentId: string;
    phoneNumberId: string;
    twilioCallSid: string;
    callerNumber: string;
    calledNumber: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.call.upsert({
      where: { twilioCallSid: input.twilioCallSid },
      create: {
        ...input,
        direction: "OUTBOUND",
        status: "RINGING",
        source: "VOICE",
      },
      update: {
        status: "RINGING",
      },
      include: this.defaultInclude(),
    });
  }

  async updateStatus(organizationId: string, callId: string, status: CallStatus) {
    const terminal = ["COMPLETED", "FAILED", "MISSED"].includes(status);
    const result = await this.prisma.call.updateMany({
      where: { id: callId, organizationId },
      data: {
        status,
        ...(status === "CONNECTED" ? { answeredAt: new Date() } : {}),
        ...(terminal ? { endedAt: new Date() } : {}),
      },
    });
    if (status === "COMPLETED") {
      const call = await this.prisma.call.findFirst({
        where: { id: callId, organizationId },
        select: {
          id: true,
          callerNumber: true,
          direction: true,
          endedAt: true,
          durationSeconds: true,
        },
      });
      if (call?.callerNumber) {
        await this.customerTimeline?.recordEvent({
          organizationId,
          phone: call.callerNumber,
          eventType: "CALL_COMPLETED",
          sourceEntityType: "Call",
          sourceEntityId: call.id,
          idempotencyKey: `call:completed:${call.id}`,
          metadata: {
            direction: call.direction,
            durationSeconds: call.durationSeconds,
          },
          occurredAt: call.endedAt ?? new Date(),
        });
      }
    }
    return result;
  }

  async list(options: CallListOptions) {
    const searchIds = options.search
      ? await this.fullTextSearchIds(options.organizationId, options.search)
      : undefined;
    const where = this.buildScopedWhere(options, searchIds);
    const cursor = options.cursor ? parseCursor(options.cursor) : null;
    const canUseCursor = this.canUseCursor(options);
    const take = options.limit + 1;
    const [total, data] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.findMany({
        where: canUseCursor && cursor ? { AND: [where, this.cursorWhere(cursor, options)] } : where,
        include: this.defaultInclude(),
        orderBy: this.orderBy(options),
        skip: canUseCursor ? undefined : (options.page - 1) * options.limit,
        take,
      }),
    ]);
    const pageData = data.slice(0, options.limit);
    return {
      total,
      data: pageData,
      nextCursor: data.length > options.limit ? encodeCursor(pageData[pageData.length - 1]) : null,
    };
  }

  findById(organizationId: string, callId: string) {
    return this.prisma.call.findFirst({
      where: { id: callId, organizationId },
      include: this.defaultInclude(),
    });
  }

  findTimelineById(organizationId: string, callId: string) {
    return this.prisma.call.findFirst({
      where: { id: callId, organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        createdAt: true,
        sessions: {
          select: {
            id: true,
            streamSid: true,
            status: true,
            connectedAt: true,
            disconnectedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        realtimeSessions: {
          select: {
            id: true,
            openAiSessionId: true,
            status: true,
            connectedAt: true,
            disconnectedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        recordings: {
          select: {
            id: true,
            status: true,
            recordingStartedAt: true,
            recordingCompletedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        transcripts: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        conversation: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async stats(organizationId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const where: Prisma.CallWhereInput = { organizationId };
    const [
      totalCalls,
      todayCalls,
      completedCalls,
      failedCalls,
      missedCalls,
      duration,
      withRecording,
      withTranscript,
      statusDistribution,
      callsPerDay,
      averageResponseTime,
      recentCalls,
    ] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.count({ where: { ...where, startedAt: { gte: startOfToday } } }),
      this.prisma.call.count({ where: { ...where, status: "COMPLETED" } }),
      this.prisma.call.count({ where: { ...where, status: "FAILED" } }),
      this.prisma.call.count({ where: { ...where, status: "MISSED" } }),
      this.prisma.call.aggregate({
        where: { ...where, durationSeconds: { not: null } },
        _avg: { durationSeconds: true },
      }),
      this.prisma.call.count({ where: { ...where, callRecordingId: { not: null } } }),
      this.prisma.call.count({ where: { ...where, callTranscriptId: { not: null } } }),
      this.prisma.call.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.callsPerDay(organizationId),
      this.averageResponseTimeMs(organizationId),
      this.prisma.call.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
    ]);
    return {
      totalCalls,
      todayCalls,
      completedCalls,
      failedCalls,
      missedCalls,
      averageDurationSeconds: Math.round(duration._avg.durationSeconds ?? 0),
      recordingRate: totalCalls === 0 ? 0 : Math.round((withRecording / totalCalls) * 100),
      transcriptionRate: totalCalls === 0 ? 0 : Math.round((withTranscript / totalCalls) * 100),
      averageResponseTimeMs: averageResponseTime,
      statusDistribution: statusDistribution.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      callsPerDay,
      recentCalls,
    };
  }

  async exportRows(options: CallListOptions, cursor?: string | null, take = 1000) {
    const searchIds = options.search
      ? await this.fullTextSearchIds(options.organizationId, options.search)
      : undefined;
    const parsedCursor = cursor ? parseCursor(cursor) : null;
    const where = this.buildScopedWhere({ ...options, sortBy: "startedAt", sortOrder: "asc" }, searchIds);
    const rows = await this.prisma.call.findMany({
      where: parsedCursor
        ? {
            AND: [
              where,
              this.cursorWhere(parsedCursor, { ...options, sortBy: "startedAt", sortOrder: "asc" }),
            ],
          }
        : where,
      select: {
        id: true,
        twilioCallSid: true,
        callerNumber: true,
        calledNumber: true,
        direction: true,
        status: true,
        source: true,
        endReason: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        durationSeconds: true,
        agent: { select: { id: true, name: true } },
        phoneNumber: { select: { id: true, phoneNumber: true, friendlyName: true } },
        callTranscript: { select: { id: true, status: true, summary: true } },
      },
      orderBy: this.orderBy({ ...options, sortBy: "startedAt", sortOrder: "asc" }),
      take: take + 1,
    });
    const page = rows.slice(0, take);
    return {
      data: page,
      nextCursor: rows.length > take ? encodeCursor(page[page.length - 1]) : null,
    };
  }

  linkConversation(organizationId: string, callId: string, conversationId: string) {
    return this.prisma.call.updateMany({
      where: { id: callId, organizationId, conversationId: null },
      data: { conversationId },
    });
  }

  linkRecording(organizationId: string, callId: string, recordingId: string) {
    return this.prisma.call.updateMany({
      where: { id: callId, organizationId },
      data: { callRecordingId: recordingId },
    });
  }

  linkTranscript(organizationId: string, callId: string, transcriptId: string) {
    return this.prisma.call.updateMany({
      where: { id: callId, organizationId },
      data: { callTranscriptId: transcriptId },
    });
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
    const like = `%${search}%`;
    const matches = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT call."id"
      FROM "calls" call
      INNER JOIN "agents" agent ON agent."id" = call."agentId"
      LEFT JOIN "call_transcripts" transcript
        ON transcript."callId" = call."id"
        AND transcript."organizationId" = call."organizationId"
      WHERE call."organizationId" = ${organizationId}
        AND (
          to_tsvector(
            'simple',
            coalesce(call."callerNumber", '') || ' ' ||
            coalesce(call."calledNumber", '') || ' ' ||
            coalesce(call."twilioCallSid", '') || ' ' ||
            coalesce(call."conversationId", '')
          ) @@ websearch_to_tsquery('simple', ${search})
          OR call."id" ILIKE ${like}
          OR call."twilioCallSid" ILIKE ${like}
          OR call."callerNumber" ILIKE ${like}
          OR call."calledNumber" ILIKE ${like}
          OR call."conversationId" ILIKE ${like}
          OR agent."name" ILIKE ${like}
          OR transcript."fullText" ILIKE ${like}
          OR transcript."summary" ILIKE ${like}
        )
      ORDER BY call."startedAt" DESC, call."id" ASC
      LIMIT 5000
    `);
    return [...new Set(matches.map((match) => match.id))];
  }

  private buildScopedWhere(options: CallListOptions, searchIds?: string[]): Prisma.CallWhereInput {
    return {
      organizationId: options.organizationId,
      ...(searchIds ? { id: { in: searchIds } } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.direction ? { direction: options.direction } : {}),
      ...(options.source ? { source: options.source } : {}),
      ...(options.endReason ? { endReason: options.endReason } : {}),
      ...(options.agentId ? { agentId: options.agentId } : {}),
      ...(options.phoneNumberId ? { phoneNumberId: options.phoneNumberId } : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            startedAt: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
      ...(options.durationMin !== undefined || options.durationMax !== undefined
        ? {
            durationSeconds: {
              ...(options.durationMin !== undefined ? { gte: options.durationMin } : {}),
              ...(options.durationMax !== undefined ? { lte: options.durationMax } : {}),
            },
          }
        : {}),
    };
  }

  private orderBy(
    options: CallListOptions,
  ): Prisma.CallOrderByWithRelationInput | Prisma.CallOrderByWithRelationInput[] {
    const sortOrder = options.sortOrder ?? "desc";
    switch (options.sortBy) {
      case "durationSeconds":
        return { durationSeconds: sortOrder };
      case "status":
        return { status: sortOrder };
      case "startedAt":
      default:
        return [{ startedAt: sortOrder }, { id: sortOrder }] as Prisma.CallOrderByWithRelationInput;
    }
  }

  private canUseCursor(options: CallListOptions) {
    return !options.sortBy || options.sortBy === "startedAt";
  }

  private cursorWhere(cursor: CallCursor, options: CallListOptions): Prisma.CallWhereInput {
    const sortOrder = options.sortOrder ?? "desc";
    const startedAt = new Date(cursor.startedAt);
    if (sortOrder === "asc") {
      return {
        OR: [{ startedAt: { gt: startedAt } }, { startedAt, id: { gt: cursor.id } }],
      };
    }
    return {
      OR: [{ startedAt: { lt: startedAt } }, { startedAt, id: { lt: cursor.id } }],
    };
  }

  private async callsPerDay(organizationId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(Prisma.sql`
      SELECT date_trunc('day', "startedAt") AS day, count(*) AS count
      FROM "calls"
      WHERE "organizationId" = ${organizationId}
        AND "startedAt" >= now() - interval '13 days'
      GROUP BY day
      ORDER BY day ASC
    `);
    return rows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      count: Number(row.count),
    }));
  }

  private async averageResponseTimeMs(organizationId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ average_ms: number | null }>>(Prisma.sql`
      SELECT avg(extract(epoch from ("answeredAt" - "startedAt")) * 1000)::float AS average_ms
      FROM "calls"
      WHERE "organizationId" = ${organizationId}
        AND "answeredAt" IS NOT NULL
    `);
    return Math.round(rows[0]?.average_ms ?? 0);
  }

  private defaultInclude() {
    return {
      agent: { select: { id: true, name: true, status: true } },
      phoneNumber: { select: { id: true, phoneNumber: true, friendlyName: true } },
      conversation: {
        select: {
          id: true,
          status: true,
          channel: true,
          source: true,
          startedAt: true,
          lastMessageAt: true,
          endedAt: true,
          _count: { select: { messages: true } },
        },
      },
      callRecording: {
        select: {
          id: true,
          status: true,
          fileName: true,
          durationSeconds: true,
          fileSizeBytes: true,
        },
      },
      callTranscript: {
        select: {
          id: true,
          status: true,
          language: true,
          wordCount: true,
          confidence: true,
          summary: true,
        },
      },
      _count: {
        select: { sessions: true, realtimeSessions: true, recordings: true, transcripts: true },
      },
    } satisfies Prisma.CallInclude;
  }
}

function encodeCursor(call: { startedAt: Date; id: string } | undefined): string | null {
  if (!call) return null;
  return Buffer.from(JSON.stringify({ startedAt: call.startedAt.toISOString(), id: call.id })).toString(
    "base64url",
  );
}

function parseCursor(value: string): CallCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CallCursor>;
    if (!parsed.startedAt || !parsed.id || Number.isNaN(new Date(parsed.startedAt).getTime())) {
      return null;
    }
    return { startedAt: parsed.startedAt, id: parsed.id };
  } catch {
    return null;
  }
}
