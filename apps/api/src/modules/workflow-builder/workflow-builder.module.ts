import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { WorkflowBuilderController } from "./workflow-builder.controller";
import { WorkflowCloneService } from "./workflow-clone.service";
import { WorkflowTemplateService } from "./workflow-template.service";

@Module({
  imports: [AuthModule, TenantModule, AnalyticsModule],
  controllers: [WorkflowBuilderController],
  providers: [WorkflowTemplateService, WorkflowCloneService],
  exports: [WorkflowTemplateService, WorkflowCloneService],
})
export class WorkflowBuilderModule {}
