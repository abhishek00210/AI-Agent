import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { AutomationEngineService } from "./automation-engine.service";
import { AutomationRepository } from "./automation-repository";
import type { AutomationJobData } from "./automation.types";

@Injectable()
export class AutomationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationSchedulerService.name);
  private queue?: Queue<AutomationJobData>;
  private worker?: Worker<AutomationJobData>;
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly engine: AutomationEngineService,
    private readonly repository: AutomationRepository,
  ) {}

  onModuleInit() {
    this.engine.attachScheduler(this);
    const redisUrl = this.config.get<string>("redis.url");
    if (redisUrl) {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue("follow-up-automations", {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { count: 2_000 },
          removeOnFail: { count: 2_000 },
        },
      });
      this.worker = new Worker(
        "follow-up-automations",
        (job: Job<AutomationJobData>) =>
          this.engine.execute(job.data.organizationId, job.data.executionId).then(() => undefined),
        { connection, concurrency: 10 },
      );
      this.worker.on("failed", (job, error) =>
        this.logger.warn(`Automation job ${job?.id ?? "unknown"} failed: ${error.name}`),
      );
    }
    this.sweepTimer = setInterval(() => void this.safeSweep(), 60_000);
    this.sweepTimer.unref();
    void this.safeSweep();
  }

  async onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await this.worker?.close();
    await this.queue?.close();
  }

  async schedule(organizationId: string, executionId: string, scheduledFor: Date) {
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    if (!this.queue) return;
    try {
      await this.queue.add(
        "ExecuteAutomation",
        { organizationId, executionId },
        { delay, jobId: `automation-${executionId}` },
      );
    } catch (error) {
      this.logger.warn(
        `Automation ${executionId} remains durable in the database because queueing failed: ${error instanceof Error ? error.name : "QueueError"}`,
      );
    }
  }

  async sweep() {
    const due = await this.repository.due();
    await Promise.all(
      due.map((item) =>
        this.queue
          ? this.schedule(item.organizationId, item.id, new Date())
          : this.engine
              .execute(item.organizationId, item.id)
              .catch((error) =>
                this.logger.warn(
                  `Automation fallback execution failed: ${error instanceof Error ? error.name : "UnknownError"}`,
                ),
              ),
      ),
    );
    return { queued: due.length, queueAvailable: Boolean(this.queue) };
  }

  private async safeSweep() {
    try {
      return await this.sweep();
    } catch (error) {
      this.logger.warn(
        `Automation recovery sweep failed without stopping the API: ${error instanceof Error ? error.name : "UnknownError"}`,
      );
      return { queued: 0, queueAvailable: Boolean(this.queue) };
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
