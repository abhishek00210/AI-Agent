import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module"; import { TenantModule } from "../tenant/tenant.module"; import { UsageModule } from "../usage/usage.module";
import { CustomerTimelineController } from "./customer-timeline.controller"; import { CustomerTimelineService } from "./customer-timeline.service"; import { TimelineEventFactory } from "./timeline-event.factory";
@Module({ imports: [AuthModule, TenantModule, UsageModule], controllers: [CustomerTimelineController], providers: [CustomerTimelineService, TimelineEventFactory], exports: [CustomerTimelineService] })
export class CustomerTimelineModule {}
