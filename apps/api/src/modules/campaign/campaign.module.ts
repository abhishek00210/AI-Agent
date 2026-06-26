import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { OutboundCallModule } from "../outbound-call/outbound-call.module";
import { TenantModule } from "../tenant/tenant.module";
import { UsageModule } from "../usage/usage.module";
import { CampaignSchedulerService } from "./campaign-scheduler.service";
import { CampaignTargetService } from "./campaign-target.service";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";

@Module({
  imports: [AuthModule, TenantModule, BillingModule, OutboundCallModule, CustomerTimelineModule, UsageModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignTargetService, CampaignSchedulerService],
  exports: [CampaignService, CampaignSchedulerService],
})
export class CampaignModule {}
