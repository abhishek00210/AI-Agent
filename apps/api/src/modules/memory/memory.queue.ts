import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { MemoryGenerationService } from "./memory-generation.service";
import type { MemoryJobContext } from "./memory.types";

const QUEUE_NAME = "conversation-memory";

type MemoryJobName = "GenerateSummary" | "ExtractFacts" | "RefreshMemory";

@Injectable()
export class MemoryQueue implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<MemoryJobContext, void, MemoryJobName>;
  private worker!: Worker<MemoryJobContext, void, MemoryJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly generation: MemoryGenerationService,
  ) {}

  onModuleInit() {
    const connection = {
      url: this.config.getOrThrow<string>("redis.url"),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue<MemoryJobContext, void, MemoryJobName>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
    this.worker = new Worker<MemoryJobContext, void, MemoryJobName>(
      QUEUE_NAME,
      (job) => this.process(job),
      { connection, concurrency: 2 },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  enqueueRefresh(input: MemoryJobContext, messageCount: number) {
    return this.queue.add("RefreshMemory", input, {
      jobId: `memory-${input.organizationId}-${input.conversationId}-${messageCount}`,
    });
  }

  private async process(job: Job<MemoryJobContext, void, MemoryJobName>) {
    await this.generation.generate(job.data);
    await job.updateProgress(100);
  }
}
