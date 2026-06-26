import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { LaunchReadinessReportService } from "./launch-readiness-report.service";

@UseGuards(AdminAuthGuard)
@Controller("admin/launch-readiness")
export class E2ETestController {
  constructor(private readonly reports: LaunchReadinessReportService) {}

  @Get()
  verify() { return this.reports.run(); }

  @Get("report")
  @Header("content-type", "text/markdown; charset=utf-8")
  report() { return this.reports.markdown(); }
}
