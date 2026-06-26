import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminModule } from "../admin/admin.module";
import { CustomerMemoryModule } from "../customer-memory/customer-memory.module";
import { E2ETestController } from "./e2e-test.controller";
import { LaunchReadinessReportService } from "./launch-readiness-report.service";
import { PlatformVerificationService } from "./platform-verification.service";

@Module({
  imports: [JwtModule.register({}), AdminModule, CustomerMemoryModule],
  controllers: [E2ETestController],
  providers: [PlatformVerificationService, LaunchReadinessReportService],
  exports: [PlatformVerificationService, LaunchReadinessReportService],
})
export class E2ETestModule {}
