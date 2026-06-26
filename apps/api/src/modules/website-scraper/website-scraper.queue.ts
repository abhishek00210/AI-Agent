import { Injectable, OnModuleInit } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
import { WebsiteScraperService } from "./website-scraper.service";

const QUEUE_KEY = "queues:website-scraping";
const MAX_ATTEMPTS = 3;

interface WebsiteScrapingJob {
  websiteSourceId: string;
  actorUserId?: string;
  attempt: number;
  kind: "initial" | "rescrape";
}

@Injectable()
export class WebsiteScraperQueue implements OnModuleInit {
  private processing = false;

  constructor(
    private readonly redis: RedisService,
    private readonly scraper: WebsiteScraperService,
  ) {}

  onModuleInit() {
    setImmediate(() => void this.processPending());
  }

  async enqueue(input: {
    websiteSourceId: string;
    actorUserId?: string;
    kind?: WebsiteScrapingJob["kind"];
  }) {
    const job: WebsiteScrapingJob = {
      websiteSourceId: input.websiteSourceId,
      actorUserId: input.actorUserId,
      kind: input.kind ?? "initial",
      attempt: 1,
    };
    await this.redis.queueConnection.lpush(QUEUE_KEY, JSON.stringify(job));
    setImmediate(() => void this.processPending());
  }

  private async processPending() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      while (true) {
        const payload = await this.redis.queueConnection.rpop(QUEUE_KEY);
        if (!payload) {
          return;
        }

        const job = JSON.parse(payload) as WebsiteScrapingJob;
        try {
          await this.scraper.processScrapeJob(job);
        } catch {
          if (job.attempt < MAX_ATTEMPTS) {
            await this.redis.queueConnection.lpush(
              QUEUE_KEY,
              JSON.stringify({ ...job, attempt: job.attempt + 1 }),
            );
          } else {
            await this.scraper.markJobFailed(job.websiteSourceId, job.actorUserId);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export type { WebsiteScrapingJob };
