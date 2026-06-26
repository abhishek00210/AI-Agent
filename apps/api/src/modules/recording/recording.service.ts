import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { Prisma, RecordingStatus } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { RECORDING_MIME_TYPE } from "./recording.types";
import type { ListRecordingsQueryDto } from "./dto/recording.dto";
import { RecordingBufferService } from "./recording-buffer.service";
import { RecordingRepository } from "./repositories/recording.repository";
import { RecordingUploadWorker } from "./recording-upload-worker";
import { RecordingWriterService } from "./recording-writer.service";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);

  constructor(
    private readonly recordings: RecordingRepository,
    private readonly buffers: RecordingBufferService,
    private readonly writer: RecordingWriterService,
    private readonly worker: RecordingUploadWorker,
    private readonly storage: StorageService,
  ) {}

  async startForSession(session: {
    id: string;
    callId: string;
    organizationId: string;
    twilioCallSid: string;
    streamSid: string | null;
  }) {
    if (!session.streamSid) {
      return null;
    }

    const recording = await this.recordings.upsertStarted({
      organizationId: session.organizationId,
      callId: session.callId,
      callSessionId: session.id,
      twilioCallSid: session.twilioCallSid,
      fileName: `call-${session.callId}-recording.wav`,
      mimeType: RECORDING_MIME_TYPE,
    });
    const rawPath = await this.writer.createRawPath(recording.id);
    this.buffers.register({
      recordingId: recording.id,
      organizationId: recording.organizationId,
      callId: recording.callId,
      callSessionId: recording.callSessionId,
      twilioCallSid: recording.twilioCallSid,
      streamSid: session.streamSid,
      rawPath,
      startedAt: (recording.recordingStartedAt ?? new Date()).toISOString(),
    });
    await this.audit(recording.organizationId, "recording.started", recording.id, {
      callId: recording.callId,
      callSessionId: recording.callSessionId,
      streamSid: session.streamSid,
    });
    return toRecordingResponse(recording);
  }

  async stopForStream(streamSid: string) {
    const job = await this.buffers.close(streamSid);
    if (!job) {
      return null;
    }

    await this.audit(job.organizationId, "recording.completed", job.recordingId, {
      callId: job.callId,
      callSessionId: job.callSessionId,
      receivedBytes: job.receivedBytes,
      droppedBytes: job.droppedBytes,
    });
    await this.worker.enqueueFinalize(job);
    return job;
  }

  capture(streamSid: string, payload: string): void {
    this.buffers.capture(streamSid, payload);
  }

  async list(context: TenantContext, query: ListRecordingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.recordings.list({
      organizationId: context.organizationId,
      page,
      limit,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as RecordingStatus | undefined,
      callId: query.callId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
    return {
      total: result.total,
      page,
      limit,
      data: result.data.map(toRecordingResponse),
    };
  }

  async getById(context: TenantContext, recordingId: string) {
    const recording = await this.recordings.findById(context.organizationId, recordingId);
    if (!recording) {
      throw new NotFoundException("Recording not found.");
    }
    return toRecordingResponse(recording);
  }

  async download(context: TenantContext, recordingId: string) {
    const recording = await this.recordings.findById(context.organizationId, recordingId);
    if (!recording) {
      throw new NotFoundException("Recording not found.");
    }
    if (recording.status !== "AVAILABLE" || !recording.storagePath) {
      throw new ServiceUnavailableException("Recording is not available yet.");
    }

    const access = await this.storage.createDownloadUrl(
      recording.storagePath,
      recording.fileName,
      recording.mimeType,
    );
    await this.audit(recording.organizationId, "recording.downloaded", recording.id, {
      callId: recording.callId,
    });
    return access;
  }

  async delete(context: TenantContext, recordingId: string) {
    const recording = await this.recordings.findById(context.organizationId, recordingId);
    if (!recording) {
      throw new NotFoundException("Recording not found.");
    }

    if (recording.storagePath) {
      await this.storage.delete(recording.storagePath).catch((error) => {
        this.logger.warn(`Recording storage delete failed: ${readError(error)}`);
      });
    }
    await this.recordings.markDeleted(context.organizationId, recordingId);
    await this.audit(context.organizationId, "recording.deleted", recordingId, {
      callId: recording.callId,
    });
    return { success: true as const };
  }

  stats(context: TenantContext) {
    return this.recordings.stats(context.organizationId);
  }

  private audit(
    organizationId: string,
    action: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.recordings.createAuditEvent({
      organizationId,
      action,
      entityType: "CallRecording",
      entityId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    });
  }
}

export function toRecordingResponse(recording: {
  id: string;
  organizationId: string;
  callId: string;
  callSessionId: string;
  twilioCallSid: string;
  storageProvider: string | null;
  storagePath: string | null;
  fileName: string;
  mimeType: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: string;
  recordingStartedAt: Date | null;
  recordingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  call?: {
    id: string;
    callerNumber: string;
    calledNumber: string;
    startedAt: Date;
    agent: { id: string; name: string; status: string };
  };
}) {
  return {
    id: recording.id,
    organizationId: recording.organizationId,
    callId: recording.callId,
    callSessionId: recording.callSessionId,
    twilioCallSid: recording.twilioCallSid,
    storageProvider: recording.storageProvider,
    fileName: recording.fileName,
    mimeType: recording.mimeType,
    durationSeconds: recording.durationSeconds,
    fileSizeBytes: recording.fileSizeBytes,
    status: recording.status,
    recordingStartedAt: recording.recordingStartedAt,
    recordingCompletedAt: recording.recordingCompletedAt,
    createdAt: recording.createdAt,
    updatedAt: recording.updatedAt,
    call: recording.call,
  };
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
