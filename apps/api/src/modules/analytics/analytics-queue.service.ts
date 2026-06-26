import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { AnalyticsAggregationService } from "./analytics-aggregation.service";
import { AnalyticsRepository } from "./analytics.repository";
import { AnalyticsSnapshotService } from "./analytics-snapshot.service";

type JobName =
  | "DailyAggregation"
  | "HistoricalBackfill"
  | "MetricReconciliation"
  | "SnapshotGeneration";
type JobData = { organizationId?: string; from?: string; to?: string };

@Injectable()
export class AnalyticsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsQueueService.name);
  private queue?: Queue<JobData, void, JobName>;
  private worker?: Worker<JobData, void, JobName>;
  constructor(
    private readonly config: ConfigService,
    private readonly aggregation: AnalyticsAggregationService,
    private readonly snapshots: AnalyticsSnapshotService,
    private readonly repository: AnalyticsRepository,
  ) {}
  onModuleInit() {
    const url = this.config.get<string>("redis.url");
    if (!url) return;
    const connection = { url, maxRetriesPerRequest: null };
    this.queue = new Queue("analytics-aggregation", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
    this.worker = new Worker("analytics-aggregation", (job) => this.process(job), {
      connection,
      concurrency: 2,
    });
    this.worker.on("failed", (job, error) =>
      this.logger.warn(`Analytics job ${job?.id ?? "unknown"} failed: ${error.name}`),
    );
    void this.schedulers();
  }
  async enqueue(name: JobName, data: JobData = {}) {
    await this.queue?.add(name, data);
  }
  private async process(job: Job<JobData, void, JobName>) {
    if (job.name === "MetricReconciliation") {
      const pending = await this.repository.unprocessedEvents();
      for (const event of pending) await this.repository.applyEvent(event);
    }
    const organizations = job.data.organizationId
      ? [{ id: job.data.organizationId }]
      : await this.repository.organizations();
    for (const organization of organizations) {
      if (job.name === "SnapshotGeneration") await this.snapshots.generate(organization.id);
      else if (job.name === "HistoricalBackfill")
        await this.aggregation.backfill(
          organization.id,
          new Date(job.data.from ?? Date.now() - 30 * 86_400_000),
          new Date(job.data.to ?? Date.now() + 86_400_000),
        );
      else await this.aggregation.reconcileDay(organization.id, new Date());
    }
  }
  private async schedulers() {
    if (!this.queue) return;
    await Promise.all([
      this.queue.upsertJobScheduler(
        "DailyAggregation",
        { pattern: "10 1 * * *" },
        { name: "DailyAggregation", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "MetricReconciliation",
        { every: 60 * 60 * 1000 },
        { name: "MetricReconciliation", data: {} },
      ),
      this.queue.upsertJobScheduler(
        "SnapshotGeneration",
        { pattern: "20 1 * * *" },
        { name: "SnapshotGeneration", data: {} },
      ),
    ]).catch((error) =>
      this.logger.warn(
        `Analytics schedulers unavailable: ${error instanceof Error ? error.name : "UnknownError"}`,
      ),
    );
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
