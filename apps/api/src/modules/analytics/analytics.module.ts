import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { AnalyticsAggregationService } from "./analytics-aggregation.service";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsQueueService } from "./analytics-queue.service";
import { AnalyticsRepository } from "./analytics.repository";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsSnapshotService } from "./analytics-snapshot.service";

@Global()
@Module({
  imports: [AuthModule, TenantModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsAggregationService,
    AnalyticsSnapshotService,
    AnalyticsQueueService,
    AnalyticsService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsAggregationService,
    AnalyticsSnapshotService,
    AnalyticsQueueService,
  ],
})
export class AnalyticsModule {}
