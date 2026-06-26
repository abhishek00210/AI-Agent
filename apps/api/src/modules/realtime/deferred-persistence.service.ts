import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DeferredPersistenceService implements OnModuleDestroy {
  private readonly logger = new Logger(DeferredPersistenceService.name);
  private readonly queue: Array<() => Promise<unknown>> = [];
  private draining = false;

  constructor(private readonly config: ConfigService) {}

  enqueue(task: () => Promise<unknown>): boolean {
    const maxQueue = this.config.get<number>("openai.realtimePersistenceQueueSize") ?? 1_000;
    if (this.queue.length >= maxQueue) {
      this.logger.error("Realtime persistence queue is full; dropping non-critical write.");
      return false;
    }
    this.queue.push(task);
    this.scheduleDrain();
    return true;
  }

  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) {
        continue;
      }
      try {
        await task();
      } catch (error) {
        this.logger.error(`Deferred realtime persistence failed: ${readError(error)}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.flush();
  }

  private scheduleDrain() {
    if (this.draining) {
      return;
    }
    this.draining = true;
    setImmediate(() => {
      void this.flush().finally(() => {
        this.draining = false;
        if (this.queue.length > 0) {
          this.scheduleDrain();
        }
      });
    });
  }
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
