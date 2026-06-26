import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, type Job } from "bullmq";
import { CallSummaryService } from "./call-summary.service";
import { CALL_SUMMARY_QUEUE_NAME, type GenerateCallSummaryJob } from "./call-summary.types";

type CallSummaryJobName = "GenerateCallSummary" | "RetryCallSummary";

@Injectable()
export class SummaryGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SummaryGenerationWorker.name);
  private queue?: Queue<GenerateCallSummaryJob, void, CallSummaryJobName>;
  private worker?: Worker<GenerateCallSummaryJob, void, CallSummaryJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly summaries: CallSummaryService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) {
      this.logger.warn("Redis URL is not configured; call summaries will use local fallback.");
      return;
    }
    const connection = { url: redisUrl, maxRetriesPerRequest: null };
    this.queue = new Queue<GenerateCallSummaryJob, void, CallSummaryJobName>(
      CALL_SUMMARY_QUEUE_NAME,
      {
        connection,
        defaultJobOptions: {
          attempts: this.config.get<number>("openai.summaryMaxAttempts") ?? 5,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      },
    );
    this.worker = new Worker<GenerateCallSummaryJob, void, CallSummaryJobName>(
      CALL_SUMMARY_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: this.config.get<number>("openai.summaryWorkerConcurrency") ?? 2,
      },
    );
    this.worker.on("failed", (job, error) => void this.onFailed(job, error));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueForTranscript(organizationId: string, transcriptId: string, force = false) {
    const job: GenerateCallSummaryJob = { organizationId, transcriptId, force };
    if (!this.queue) {
      setImmediate(() => void this.processData(job).catch((error) => this.logFallbackError(error)));
      return true;
    }
    await this.queue.add(force ? "RetryCallSummary" : "GenerateCallSummary", job, {
      jobId: force
        ? `call-summary-${transcriptId}-retry-${Date.now()}`
        : `call-summary-${transcriptId}`,
    });
    return true;
  }

  private async process(job: Job<GenerateCallSummaryJob, void, CallSummaryJobName>) {
    await this.processData(job.data);
    await job.updateProgress(100);
  }

  private async processData(data: GenerateCallSummaryJob) {
    try {
      await this.summaries.generateForTranscript(data);
    } catch (error) {
      await this.summaries.recordFailure({
        organizationId: data.organizationId,
        transcriptId: data.transcriptId,
        reason: readError(error),
      });
      throw error;
    }
  }

  private async onFailed(job: Job<GenerateCallSummaryJob> | undefined, error: Error) {
    if (!job) return;
    this.logger.warn(
      `Call summary job failed (${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
    );
  }

  private logFallbackError(error: unknown) {
    this.logger.error(`Local call summary fallback failed: ${readError(error)}`);
  }
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown call summary error";
}
