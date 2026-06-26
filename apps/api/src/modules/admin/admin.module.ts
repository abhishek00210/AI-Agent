import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SecurityModule } from "../../security/security.module";
import { BillingModule } from "../billing/billing.module";
import { AdminAuditService } from "./admin-audit.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminBootstrapService } from "./admin-bootstrap.service";
import { AdminAuthController, AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ExternalNumberModule } from "../external-number/external-number.module";
import { PortRequestModule } from "../port-request/port-request.module";
import { CustomerMemoryModule } from "../customer-memory/customer-memory.module";
import { AutomationModule } from "../automation/automation.module";
import { WorkflowBuilderModule } from "../workflow-builder/workflow-builder.module";
import { CampaignModule } from "../campaign/campaign.module";
import { PerformanceModule } from "../performance/performance.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { PaymentModule } from "../payments/payment.module";

@Module({
  imports: [
    JwtModule.register({}),
    SecurityModule,
    BillingModule,
    ExternalNumberModule,
    PortRequestModule,
    CustomerMemoryModule,
    AutomationModule,
    WorkflowBuilderModule,
    CampaignModule,
    PerformanceModule,
    TelephonyModule,
    PaymentModule,
  ],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminService, AdminAuditService, AdminAuthGuard, AdminBootstrapService],
  exports: [AdminAuditService, AdminAuthGuard],
})
export class AdminModule {}
