import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { EmbeddingService, type EmbeddingJobContext } from "./embedding.service";

const QUEUE_NAME = "embedding-processing";

type EmbeddingJobName = "ProcessDocument" | "ProcessWebsite" | "GenerateEmbeddings";

@Injectable()
export class EmbeddingQueue implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<EmbeddingJobContext, void, EmbeddingJobName>;
  private worker!: Worker<EmbeddingJobContext, void, EmbeddingJobName>;

  constructor(
    private readonly config: ConfigService,
    private readonly embeddings: EmbeddingService,
  ) {}

  onModuleInit() {
    const connection = {
      url: this.config.getOrThrow<string>("redis.url"),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue<EmbeddingJobContext, void, EmbeddingJobName>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
    this.worker = new Worker<EmbeddingJobContext, void, EmbeddingJobName>(
      QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: 2,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueueDocument(input: EmbeddingJobContext) {
    return this.queue.add("ProcessDocument", input, {
      jobId: `document-${input.organizationId}-${input.documentId}`,
    });
  }

  async enqueueWebsite(input: EmbeddingJobContext) {
    return this.queue.add("ProcessWebsite", input, {
      jobId: `website-${input.organizationId}-${input.websiteSourceId}`,
    });
  }

  private async process(job: Job<EmbeddingJobContext, void, EmbeddingJobName>) {
    if (job.name === "ProcessDocument") {
      await this.embeddings.processDocumentJob(job.data, (progress) =>
        job.updateProgress(progress),
      );
      return;
    }

    if (job.name === "ProcessWebsite") {
      await this.embeddings.processWebsiteJob(job.data, (progress) => job.updateProgress(progress));
      return;
    }
  }
}
