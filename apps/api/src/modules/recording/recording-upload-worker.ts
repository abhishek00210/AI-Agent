import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker } from "bullmq";
import {
  RECORDING_UPLOAD_ATTEMPTS,
  type FinalizeRecordingJob,
} from "./recording.types";
import { RecordingRepository } from "./repositories/recording.repository";
import { RecordingStorageService } from "./recording-storage.service";
import { TranscriptWorker } from "../transcription/transcript.worker";
import { UsageService } from "../usage/usage.service";

const QUEUE_NAME = "call-recordings";

type RecordingJobName = "FinalizeRecording" | "UploadRecording" | "CleanupTempFiles" | "RetryUpload";

@Injectable()
export class RecordingUploadWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecordingUploadWorker.name);
  private queue?: Queue<FinalizeRecordingJob, void, RecordingJobName>;
  private worker?: Worker<FinalizeRecordingJob, void, RecordingJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly recordings: RecordingRepository,
    private readonly storage: RecordingStorageService,
    private readonly transcription: TranscriptWorker,
    private readonly usage: UsageService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) {
      this.logger.warn("Redis URL is not configured; recording uploads will use local fallback.");
      return;
    }

    const connection = { url: redisUrl, maxRetriesPerRequest: null };
    this.queue = new Queue<FinalizeRecordingJob, void, RecordingJobName>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: RECORDING_UPLOAD_ATTEMPTS,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
    this.worker = new Worker<FinalizeRecordingJob, void, RecordingJobName>(
      QUEUE_NAME,
      (job) => this.process(job.data),
      { connection, concurrency: 2 },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.warn(
        `Recording job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueFinalize(job: FinalizeRecordingJob) {
    if (!this.queue) {
      this.runFallback(job);
      return;
    }

    try {
      await this.queue.add("FinalizeRecording", job, {
        jobId: `recording-${job.organizationId}-${job.recordingId}-finalize`,
      });
    } catch (error) {
      this.logger.warn(`Unable to enqueue recording finalization: ${readError(error)}`);
      this.runFallback(job);
    }
  }

  private runFallback(job: FinalizeRecordingJob, attempt = 1) {
    const run = () => {
      void this.process(job).catch((error) => {
        this.logger.warn(
          `Recording fallback finalization attempt ${attempt} failed: ${readError(error)}`,
        );
        if (attempt < RECORDING_UPLOAD_ATTEMPTS) {
          const delayMs = 1000 * 2 ** (attempt - 1);
          setTimeout(() => this.runFallback(job, attempt + 1), delayMs).unref();
        }
      });
    };

    setImmediate(run);
  }

  private async process(job: FinalizeRecordingJob) {
    try {
      await this.recordings.markProcessing(job.organizationId, job.recordingId);
      const result = await this.storage.finalizeAndUpload(job);
      const recording = await this.recordings.markAvailable(job.organizationId, job.recordingId, {
        storageProvider: result.storageProvider,
        storagePath: result.storagePath,
        durationSeconds: result.durationSeconds,
        fileSizeBytes: result.fileSizeBytes,
      });
      await this.recordings.createAuditEvent({
        organizationId: job.organizationId,
        action: "recording.uploaded",
        entityType: "CallRecording",
        entityId: job.recordingId,
        metadata: {
          callId: job.callId,
          callSessionId: job.callSessionId,
          droppedBytes: job.droppedBytes,
          fileSizeBytes: recording.fileSizeBytes,
        },
      });
      if (recording.isOutbound) {
        await this.usage
          .increment({
            organizationId: job.organizationId,
            resourceType: "OUTBOUND_RECORDINGS",
            idempotencyKey: `outbound:recording:${job.recordingId}`,
          })
          .catch((error) =>
            this.logger.warn(`Unable to track outbound recording usage: ${readError(error)}`),
          );
      }
      void this.transcription
        .enqueueForRecording(job.organizationId, job.recordingId)
        .catch((error) =>
          this.logger.warn(`Unable to enqueue transcription: ${readError(error)}`),
        );
    } catch (error) {
      await this.recordings.markFailed(job.organizationId, job.recordingId, readError(error));
      throw error;
    }
  }
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
