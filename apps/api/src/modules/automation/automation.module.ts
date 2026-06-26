import { forwardRef, Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { CommunicationModule } from "../communication/communication.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { TenantModule } from "../tenant/tenant.module";
import { OutboundCallModule } from "../outbound-call/outbound-call.module";
import { AutomationActionService } from "./automation-action.service";
import { AutomationController } from "./automation.controller";
import { AutomationEngineService } from "./automation-engine.service";
import { AutomationRepository } from "./automation-repository";
import { AutomationSchedulerService } from "./automation-scheduler.service";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    forwardRef(() => CommunicationModule),
    CustomerTimelineModule,
    AnalyticsModule,
    OutboundCallModule,
  ],
  controllers: [AutomationController],
  providers: [
    AutomationRepository,
    AutomationActionService,
    AutomationEngineService,
    AutomationSchedulerService,
  ],
  exports: [AutomationEngineService],
})
export class AutomationModule {}
