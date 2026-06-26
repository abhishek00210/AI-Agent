import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { MessageDeliveryService } from "./message-delivery.service";

export type SmsJobName = "SendSMS" | "RetrySMS" | "ReminderSMS";
export interface SmsJobData {
  organizationId: string;
  messageId: string;
}

@Injectable()
export class SmsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsQueueService.name);
  private queue?: Queue<SmsJobData, void, SmsJobName>;
  private worker?: Worker<SmsJobData, void, SmsJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly delivery: MessageDeliveryService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) return;
    const connection = { url: redisUrl, maxRetriesPerRequest: null };
    this.queue = new Queue("sms-communications", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 3_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 1_000 },
      },
    });
    this.worker = new Worker(
      "sms-communications",
      async (job: Job<SmsJobData, void, SmsJobName>) => {
        await this.delivery.deliver(job.data.organizationId, job.data.messageId, job.attemptsMade);
      },
      { connection, concurrency: 10 },
    );
    this.worker.on("failed", (job, error) =>
      this.logger.warn(`SMS job ${job?.id ?? "unknown"} failed: ${error.message}`),
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(name: SmsJobName, data: SmsJobData, delay = 0) {
    if (!this.queue) {
      const timer = setTimeout(
        () => void this.delivery.deliver(data.organizationId, data.messageId),
        delay,
      );
      timer.unref();
      return;
    }
    try {
      await this.queue.add(name, data, {
        delay,
        jobId: `${name}-${data.organizationId}-${data.messageId}`,
      });
    } catch (error) {
      this.logger.warn(
        `SMS ${data.messageId} remains queued because Redis is unavailable: ${
          error instanceof Error ? error.message : "queue failure"
        }`,
      );
    }
  }

  async depth() {
    if (!this.queue) return { waiting: 0, delayed: 0, failed: 0, available: false };
    const [waiting, delayed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, delayed, failed, available: true };
  }
}
