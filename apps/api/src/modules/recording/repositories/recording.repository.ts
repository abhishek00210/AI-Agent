import { Injectable } from "@nestjs/common";
import type { Prisma, RecordingStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface RecordingListOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: RecordingStatus;
  callId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class RecordingRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertStarted(input: {
    organizationId: string;
    callId: string;
    callSessionId: string;
    twilioCallSid: string;
    fileName: string;
    mimeType: string;
  }) {
    const recordingStartedAt = new Date();
    return this.prisma.callRecording.upsert({
      where: { callSessionId: input.callSessionId },
      create: {
        ...input,
        status: "RECORDING",
        recordingStartedAt,
      },
      update: {
        status: "RECORDING",
        recordingStartedAt,
        recordingCompletedAt: null,
      },
      include: this.defaultInclude(),
    });
  }

  markProcessing(organizationId: string, recordingId: string) {
    return this.prisma.callRecording.updateMany({
      where: {
        id: recordingId,
        organizationId,
        status: { in: ["RECORDING", "PENDING", "FAILED"] },
      },
      data: { status: "PROCESSING" },
    });
  }

  markAvailable(
    organizationId: string,
    recordingId: string,
    input: {
      storageProvider: string;
      storagePath: string;
      durationSeconds: number;
      fileSizeBytes: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const recording = await tx.callRecording.update({
        where: { id: recordingId, organizationId },
        data: {
          ...input,
          status: "AVAILABLE",
          recordingCompletedAt: new Date(),
        },
        include: this.defaultInclude(),
      });
      await tx.call.updateMany({
        where: { id: recording.callId, organizationId },
        data: { callRecordingId: recording.id },
      });
      const outbound = await tx.outboundCall.updateMany({
        where: { callId: recording.callId, organizationId },
        data: { recordingId: recording.id },
      });
      return { ...recording, isOutbound: outbound.count > 0 };
    });
  }

  markFailed(organizationId: string, recordingId: string, reason: string) {
    return this.prisma.callRecording
      .updateMany({
        where: { id: recordingId, organizationId, status: { not: "DELETED" } },
        data: {
          status: "FAILED",
          storageProvider: null,
          storagePath: null,
        },
      })
      .then((result) =>
        result.count > 0
          ? this.createAuditEvent({
              organizationId,
              action: "recording.failed",
              entityType: "CallRecording",
              entityId: recordingId,
              metadata: { reason },
            })
          : null,
      );
  }

  markDeleted(organizationId: string, recordingId: string) {
    return this.prisma.callRecording.updateMany({
      where: { id: recordingId, organizationId },
      data: { status: "DELETED" },
    });
  }

  findById(organizationId: string, recordingId: string) {
    return this.prisma.callRecording.findFirst({
      where: { id: recordingId, organizationId },
      include: this.defaultInclude(),
    });
  }

  async list(options: RecordingListOptions) {
    const where = this.buildScopedWhere(options);
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.callRecording.count({ where }),
      this.prisma.callRecording.findMany({
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
    const [total, available, failed, storage] = await Promise.all([
      this.prisma.callRecording.count({ where: { organizationId } }),
      this.prisma.callRecording.count({ where: { organizationId, status: "AVAILABLE" } }),
      this.prisma.callRecording.count({ where: { organizationId, status: "FAILED" } }),
      this.prisma.callRecording.aggregate({
        where: { organizationId, status: { not: "DELETED" } },
        _sum: { fileSizeBytes: true },
      }),
    ]);

    return {
      totalRecordings: total,
      availableRecordings: available,
      failedRecordings: failed,
      recordingStorageBytes: storage._sum.fileSizeBytes ?? 0,
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

  private buildScopedWhere(options: RecordingListOptions): Prisma.CallRecordingWhereInput {
    return {
      organizationId: options.organizationId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.callId ? { callId: options.callId } : {}),
      ...(options.dateFrom || options.dateTo
        ? {
            createdAt: {
              ...(options.dateFrom ? { gte: options.dateFrom } : {}),
              ...(options.dateTo ? { lte: options.dateTo } : {}),
            },
          }
        : {}),
      ...(options.search
        ? {
            OR: [
              { twilioCallSid: { contains: options.search, mode: "insensitive" } },
              { fileName: { contains: options.search, mode: "insensitive" } },
              { call: { callerNumber: { contains: options.search, mode: "insensitive" } } },
              { call: { calledNumber: { contains: options.search, mode: "insensitive" } } },
              { call: { agent: { name: { contains: options.search, mode: "insensitive" } } } },
            ],
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
    } satisfies Prisma.CallRecordingInclude;
  }
}
