import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommunicationModule } from "../communication/communication.module";
import { TenantModule } from "../tenant/tenant.module";
import { ContactResolver } from "./contact-resolver.service";
import { LeadController } from "./lead.controller";
import { LeadService } from "./lead.service";
import { LeadTimelineService } from "./lead-timeline.service";
import { LeadRepository } from "./repositories/lead.repository";
import { CustomerModule } from "../customer/customer.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { AutomationModule } from "../automation/automation.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { CampaignModule } from "../campaign/campaign.module";
import { UsageModule } from "../usage/usage.module";
import { LeadImportService } from "./lead-import.service";

@Module({
  imports: [AuthModule, TenantModule, CommunicationModule, CustomerModule, CustomerTimelineModule, AutomationModule, AnalyticsModule, UsageModule, CampaignModule],
  controllers: [LeadController],
  providers: [LeadRepository, ContactResolver, LeadTimelineService, LeadService, LeadImportService],
  exports: [LeadService, LeadTimelineService],
})
export class LeadModule {}
