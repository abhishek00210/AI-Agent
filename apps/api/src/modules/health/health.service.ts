import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@ai-agent-platform/types";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async status(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return {
      status: "ok",
      service: "ai-agent-platform-api",
      timestamp: new Date().toISOString(),
      dependencies: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<"configured" | "unavailable"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "configured";
    } catch {
      return "unavailable";
    }
  }

  private async checkRedis(): Promise<"configured" | "unavailable"> {
    try {
      await this.redis.cache.ping();
      return "configured";
    } catch {
      return "unavailable";
    }
  }
}
