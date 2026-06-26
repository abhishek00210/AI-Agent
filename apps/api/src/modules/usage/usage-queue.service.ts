import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { UsageService } from "./usage.service";

type UsageJobName =
  | "MonthlyUsageReset"
  | "CounterReconciliation"
  | "UsageAudit"
  | "OverageCalculation";
type UsageJobData = { organizationId?: string };

@Injectable()
export class UsageQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsageQueueService.name);
  private queue?: Queue<UsageJobData, void, UsageJobName>;
  private worker?: Worker<UsageJobData, void, UsageJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly usage: UsageService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (!redisUrl) return;
    const connection = { url: redisUrl, maxRetriesPerRequest: null };
    this.queue = new Queue("central-usage", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 1_000 },
      },
    });
    this.worker = new Worker(
      "central-usage",
      async (job: Job<UsageJobData, void, UsageJobName>) => {
        const organizations = job.data.organizationId
          ? [{ id: job.data.organizationId }]
          : await this.usage.activeOrganizationIds();
        for (const organization of organizations) {
          if (job.name === "CounterReconciliation" || job.name === "UsageAudit") {
            await this.usage.reconcile(organization.id);
          } else if (job.name === "MonthlyUsageReset") {
            await this.usage.getUsage(organization.id);
          } else if (job.name === "OverageCalculation") {
            await this.usage.getUsage(organization.id);
          }
        }
      },
      { connection, concurrency: 2 },
    );
    this.worker.on("failed", (job, error) => {
      this.metrics.increment("usage_job_failures");
      this.logger.warn(`Usage job ${job?.id ?? "unknown"} failed: ${error.name}`);
    });
    void this.registerSchedulers();
  }

  async enqueue(name: UsageJobName, organizationId?: string) {
    await this.queue?.add(
      name,
      { organizationId },
      {
        jobId: organizationId ? `${name}-${organizationId}-${Date.now()}` : undefined,
      },
    );
  }

  async depth() {
    if (!this.queue) return { available: false, waiting: 0, delayed: 0, failed: 0 };
    const [waiting, delayed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getDelayedCount(),
      this.queue.getFailedCount(),
    ]);
    return { available: true, waiting, delayed, failed };
  }

  private async registerSchedulers() {
    if (!this.queue) return;
    await Promise.all([
      this.queue.upsertJobScheduler(
        "MonthlyUsageReset",
        { pattern: "5 0 * * *" },
        { name: "MonthlyUsageReset", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "CounterReconciliation",
        { pattern: "30 2 * * *" },
        { name: "CounterReconciliation", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "UsageAudit",
        { pattern: "0 4 * * 0" },
        { name: "UsageAudit", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "OverageCalculation",
        { every: 60 * 60 * 1_000 },
        { name: "OverageCalculation", data: {} },
      ),
    ]).catch((error) => this.logger.warn(`Usage schedulers unavailable: ${readError(error)}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}

function readError(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}
