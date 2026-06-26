import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PerformanceController } from "./performance.controller";
import { LatencyMetricsService } from "./latency-metrics.service";
import { PerformanceAuditService } from "./performance-audit.service";

@Module({
  imports: [AuthModule],
  controllers: [PerformanceController],
  providers: [LatencyMetricsService, PerformanceAuditService],
  exports: [LatencyMetricsService, PerformanceAuditService],
})
export class PerformanceModule {}
