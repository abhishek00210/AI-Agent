import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker } from "bullmq";
import { CampaignService } from "./campaign.service";

interface CampaignJob {
  organizationId: string;
  campaignId: string;
}

@Injectable()
export class CampaignSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private queue?: Queue<CampaignJob>;
  private worker?: Worker<CampaignJob>;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly campaigns: CampaignService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>("redis.url");
    if (redisUrl) {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue("outbound-campaigns", {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { count: 2_000 },
          removeOnFail: { count: 2_000 },
        },
      });
      this.worker = new Worker(
        "outbound-campaigns",
        (job) => this.campaigns.dispatchNext(job.data.organizationId, job.data.campaignId).then(() => undefined),
        { connection, concurrency: 1 },
      );
      this.worker.on("failed", (job, error) =>
        this.logger.warn(`Campaign job ${job?.id ?? "unknown"} failed: ${error.name}`),
      );
    }
    this.timer = setInterval(() => void this.safeSweep(), 15_000);
    this.timer.unref();
    void this.safeSweep();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }

  async schedule(organizationId: string, campaignId: string, scheduledAt = new Date()) {
    if (!this.queue) return this.campaigns.dispatchNext(organizationId, campaignId);
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    await this.queue.add(
      "ExecuteCampaignTarget",
      { organizationId, campaignId },
      { delay, jobId: `campaign-${campaignId}-${scheduledAt.getTime()}` },
    );
    return { queued: true };
  }

  async sweep() {
    const due = await this.campaigns.dueCampaigns();
    for (const campaign of due) {
      if (this.queue) {
        await this.queue.add(
          "ExecuteCampaignTarget",
          { organizationId: campaign.organizationId, campaignId: campaign.id },
          { jobId: `campaign-sweep-${campaign.id}-${Math.floor(Date.now() / 15_000)}` },
        );
      } else {
        await this.campaigns.dispatchNext(campaign.organizationId, campaign.id);
      }
    }
    return { campaigns: due.length, queueAvailable: Boolean(this.queue) };
  }

  private async safeSweep() {
    try {
      return await this.sweep();
    } catch (error) {
      this.logger.warn(`Campaign sweep failed safely: ${error instanceof Error ? error.name : "UnknownError"}`);
      return { campaigns: 0, queueAvailable: Boolean(this.queue) };
    }
  }
}
