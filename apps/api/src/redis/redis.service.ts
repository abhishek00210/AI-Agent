import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import type Redis from "ioredis";
import { RealtimeMetricsService } from "../common/metrics/realtime-metrics.service";
import { REDIS_CLIENT } from "./redis.constants";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private available = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly metrics?: RealtimeMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.available = true;
    } catch (error) {
      this.logger.warn(
        `Redis unavailable; cache and background queues are degraded: ${
          error instanceof Error ? error.message : "connection failed"
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === "ready" || this.redis.status === "connect") {
      await this.redis.quit();
    }
  }

  get isAvailable(): boolean {
    return this.available && this.redis.status === "ready";
  }

  get cache(): Redis {
    return this.redis;
  }

  get queueConnection(): Redis {
    return this.redis;
  }

  get sessionStore(): Redis {
    return this.redis;
  }

  get rateLimitStore(): Redis {
    return this.redis;
  }

  async measure<T>(operation: string, action: () => Promise<T>): Promise<T> {
    const startedAt = this.metrics?.now();
    try {
      const result = await action();
      if (startedAt !== undefined) this.metrics?.observe("redis_lookup_ms", startedAt);
      this.metrics?.increment(`redis_${operation}_success`);
      return result;
    } catch (error) {
      if (startedAt !== undefined) this.metrics?.observe("redis_lookup_ms", startedAt, false);
      this.metrics?.increment(`redis_${operation}_failure`);
      throw error;
    }
  }

  ping() {
    return this.measure("ping", () => this.redis.ping());
  }
}
