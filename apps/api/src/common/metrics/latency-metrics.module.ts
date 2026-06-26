import { Global, Module } from "@nestjs/common";
import { RealtimeMetricsService } from "./realtime-metrics.service";

@Global()
@Module({
  providers: [RealtimeMetricsService],
  exports: [RealtimeMetricsService],
})
export class LatencyMetricsModule {}
