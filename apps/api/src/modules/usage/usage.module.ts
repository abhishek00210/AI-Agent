import { Global, Module } from "@nestjs/common";
import { UsageQueueService } from "./usage-queue.service";
import { UsageRepository } from "./usage.repository";
import { UsageService } from "./usage.service";

@Global()
@Module({
  providers: [UsageRepository, UsageService, UsageQueueService],
  exports: [UsageService, UsageQueueService],
})
export class UsageModule {}
