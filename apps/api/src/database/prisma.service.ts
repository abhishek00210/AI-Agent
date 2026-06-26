import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
import type { RawEnv } from "../config/env.schema";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<RawEnv>) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>("database.url", { infer: true }),
      max: config.get<number>("database.poolMax", { infer: true }) ?? 20,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      query_timeout: config.get<number>("database.queryTimeoutMs", { infer: true }) ?? 5_000,
      statement_timeout:
        config.get<number>("database.queryTimeoutMs", { infer: true }) ?? 5_000,
      application_name: "ai-agent-platform-api",
      options: "-c hnsw.iterative_scan=strict_order",
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
