import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OpenAiConfigService } from "../openai/openai-config.service";
import { OpenAiProvider } from "../openai/openai.provider";
import { TenantModule } from "../tenant/tenant.module";
import { ConversationSummaryService } from "./conversation-summary.service";
import { MemoryController } from "./memory.controller";
import { MemoryFactService } from "./memory-fact.service";
import { MemoryGenerationService } from "./memory-generation.service";
import { MemoryQueue } from "./memory.queue";
import { MemoryService } from "./memory.service";
import { MemoryRepository } from "./repositories/memory.repository";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [MemoryController],
  providers: [
    MemoryRepository,
    MemoryService,
    MemoryGenerationService,
    MemoryQueue,
    MemoryFactService,
    ConversationSummaryService,
    OpenAiConfigService,
    OpenAiProvider,
  ],
  exports: [MemoryService],
})
export class MemoryModule {}
