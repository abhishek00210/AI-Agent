import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { LatencyMetricsService } from "./latency-metrics.service";
import { PerformanceAuditService } from "./performance-audit.service";

@Controller()
export class PerformanceController {
  constructor(
    private readonly latency: LatencyMetricsService,
    private readonly audit: PerformanceAuditService,
  ) {}

  @Get("metrics")
  metrics(@Res() reply: FastifyReply) {
    return reply.type("text/plain; version=0.0.4").send(this.latency.prometheus());
  }

  @UseGuards(JwtAuthGuard)
  @Get("performance/audit")
  auditReport() {
    return this.audit.report();
  }
}
