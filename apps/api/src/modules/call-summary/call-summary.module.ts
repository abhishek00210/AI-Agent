import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { CustomerModule } from "../customer/customer.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { OpenAiModule } from "../openai/openai.module";
import { TenantModule } from "../tenant/tenant.module";
import { UsageModule } from "../usage/usage.module";
import { CallSummaryController } from "./call-summary.controller";
import { CallSummaryService } from "./call-summary.service";
import { CallSummaryRepository } from "./repositories/call-summary.repository";
import { SummaryGenerationWorker } from "./summary-generation.worker";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    OpenAiModule,
    CustomerModule,
    CustomerTimelineModule,
    UsageModule,
    AnalyticsModule,
  ],
  controllers: [CallSummaryController],
  providers: [CallSummaryService, CallSummaryRepository, SummaryGenerationWorker],
  exports: [CallSummaryService, SummaryGenerationWorker],
})
export class CallSummaryModule {}
