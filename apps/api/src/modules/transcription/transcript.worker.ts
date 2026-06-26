import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, type Job } from "bullmq";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Prisma } from "../../../generated/prisma";
import { OpenAiProvider } from "../openai/openai.provider";
import { SummaryGenerationWorker } from "../call-summary/summary-generation.worker";
import { StorageService } from "../storage/storage.service";
import { TranscriptRepository } from "./repositories/transcript.repository";
import { SpeakerSegmentationService } from "./speaker-segmentation.service";
import { TranscriptSummaryService } from "./transcript-summary.service";
import { UsageService } from "../usage/usage.service";
import {
  TRANSCRIPTION_DEAD_LETTER_QUEUE_NAME,
  TRANSCRIPTION_QUEUE_NAME,
  type GenerateTranscriptJob,
} from "./transcription.types";

type TranscriptJobName = "GenerateTranscript" | "GenerateSummary" | "RetryTranscript";

@Injectable()
export class TranscriptWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TranscriptWorker.name);
  private queue?: Queue<GenerateTranscriptJob, void, TranscriptJobName>;
  private deadLetterQueue?: Queue<GenerateTranscriptJob>;
  private worker?: Worker<GenerateTranscriptJob, void, TranscriptJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly transcripts: TranscriptRepository,
    private readonly storage: StorageService,
    private readonly ai: OpenAiProvider,
    private readonly segmentation: SpeakerSegmentationService,
    private readonly summaries: TranscriptSummaryService,
    private readonly usage: UsageService,
    @Optional() private readonly callSummaries?: SummaryGenerationWorker,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) {
      this.logger.warn("Redis URL is not configured; transcription will use local fallback.");
      return;
    }
    const connection = { url: redisUrl, maxRetriesPerRequest: null };
    const attempts = this.config.get<number>("openai.transcriptionMaxAttempts") ?? 5;
    this.queue = new Queue<GenerateTranscriptJob, void, TranscriptJobName>(
      TRANSCRIPTION_QUEUE_NAME,
      {
        connection,
        defaultJobOptions: {
          attempts,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      },
    );
    this.deadLetterQueue = new Queue(TRANSCRIPTION_DEAD_LETTER_QUEUE_NAME, { connection });
    this.worker = new Worker<GenerateTranscriptJob, void, TranscriptJobName>(
      TRANSCRIPTION_QUEUE_NAME,
      (job) => this.process(job.data),
      {
        connection,
        concurrency: this.config.get<number>("openai.transcriptionWorkerConcurrency") ?? 3,
      },
    );
    this.worker.on("failed", (job, error) => void this.onFailed(job, error));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.deadLetterQueue?.close();
  }

  async enqueueForRecording(
    organizationId: string,
    recordingId: string,
    force = false,
  ): Promise<boolean> {
    const transcript = await this.transcripts.upsertPendingForRecording(
      organizationId,
      recordingId,
    );
    if (!transcript) return false;
    const job: GenerateTranscriptJob = {
      organizationId,
      recordingId,
      transcriptId: transcript.id,
    };
    if (!this.queue) {
      setImmediate(() => void this.process(job).catch((error) => this.logFallbackError(error)));
      return true;
    }
    await this.queue.add(force ? "RetryTranscript" : "GenerateTranscript", job, {
      jobId: force
        ? `transcript-${transcript.id}-retry-${Date.now()}`
        : `transcript-${transcript.id}`,
    });
    return true;
  }

  async process(job: GenerateTranscriptJob): Promise<void> {
    const claimed = await this.transcripts.markProcessing(job.organizationId, job.transcriptId);
    if (claimed.count === 0) return;

    const context = await this.transcripts.processingContext(
      job.organizationId,
      job.transcriptId,
    );
    if (
      !context ||
      context.callRecording.status !== "AVAILABLE" ||
      !context.callRecording.storagePath
    ) {
      throw new Error("Recording is not available for transcription.");
    }

    const started = Date.now();
    const tempDirectory = await mkdtemp(join(tmpdir(), "call-transcript-"));
    const localPath = join(tempDirectory, sanitizeFileName(context.callRecording.fileName));
    try {
      await this.storage.downloadToFile(context.callRecording.storagePath, localPath);
      const transcription = await this.ai.transcribeAudio({
        filePath: localPath,
        fileName: context.callRecording.fileName,
        language: normalizeLanguage(context.call.agent.language),
      });
      const segments = this.segmentation.structure({
        transcriptionSegments: transcription.segments,
        conversationMessages: context.conversation?.messages ?? [],
        callStartedAt: context.call.startedAt,
      });
      const fullText =
        segments.length > 0
          ? segments.map(formatSegment).join("\n")
          : transcription.text.trim();
      const summary = await this.summaries.generate(fullText, job.organizationId);
      const confidence = averageConfidence(segments);
      const completed = await this.transcripts.complete(job.organizationId, job.transcriptId, {
        language: transcription.language,
        provider: `openai:${transcription.model}`,
        durationSeconds:
          transcription.durationSeconds ?? context.callRecording.durationSeconds ?? undefined,
        fullText,
        wordCount: countWords(fullText),
        confidence,
        summary,
        processingTimeMs: Date.now() - started,
        segments,
      });
      if (completed.isOutbound) {
        await this.usage
          .increment({
            organizationId: job.organizationId,
            resourceType: "OUTBOUND_TRANSCRIPTS",
            idempotencyKey: `outbound:transcript:${job.transcriptId}`,
          })
          .catch((error) =>
            this.logger.warn(`Unable to track outbound transcript usage: ${readError(error)}`),
          );
      }
      await this.transcripts.createAuditEvent({
        organizationId: job.organizationId,
        action: "transcript.completed",
        entityType: "CallTranscript",
        entityId: job.transcriptId,
        metadata: {
          callId: context.callId,
          recordingId: context.callRecording.id,
          segmentCount: segments.length,
          processingTimeMs: Date.now() - started,
        } as Prisma.InputJsonValue,
      });
      await this.callSummaries?.enqueueForTranscript(job.organizationId, job.transcriptId);
    } catch (error) {
      await this.transcripts.markFailed(
        job.organizationId,
        job.transcriptId,
        readError(error),
      );
      await this.transcripts.createAuditEvent({
        organizationId: job.organizationId,
        action: "transcript.failed",
        entityType: "CallTranscript",
        entityId: job.transcriptId,
        metadata: { reason: readError(error), recordingId: job.recordingId },
      });
      throw error;
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async onFailed(job: Job<GenerateTranscriptJob> | undefined, error: Error) {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    this.logger.warn(
      `Transcript job failed (${job.attemptsMade}/${maxAttempts}): ${error.message}`,
    );
    if (job.attemptsMade >= maxAttempts) {
      await this.deadLetterQueue?.add("GenerateTranscript", job.data, {
        jobId: `dead-${job.data.transcriptId}-${Date.now()}`,
        removeOnComplete: false,
        removeOnFail: false,
      });
    }
  }

  private logFallbackError(error: unknown) {
    this.logger.error(`Local transcription fallback failed: ${readError(error)}`);
  }
}

function formatSegment(segment: {
  speaker: string;
  startMs: number;
  text: string;
}): string {
  return `[${formatTimestamp(segment.startMs)}] ${segment.speaker}: ${segment.text}`;
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function averageConfidence(segments: Array<{ confidence?: number }>): number | undefined {
  const values = segments
    .map((segment) => segment.confidence)
    .filter((value): value is number => typeof value === "number");
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function normalizeLanguage(language: string): string | undefined {
  const normalized = language.trim().toLowerCase();
  const map: Record<string, string> = {
    english: "en",
    hindi: "hi",
    spanish: "es",
    french: "fr",
    german: "de",
    arabic: "ar",
  };
  return map[normalized] ?? (/^[a-z]{2}$/.test(normalized) ? normalized : undefined);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown transcription error";
}
