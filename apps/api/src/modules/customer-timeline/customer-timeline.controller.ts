import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import type { CustomerTimelineCategory, CustomerTimelineEventType } from "../../../generated/prisma";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CustomerTimelineService } from "./customer-timeline.service";
@UseGuards(JwtAuthGuard) @Controller("customers/:id")
export class CustomerTimelineController {
  constructor(private readonly timeline: CustomerTimelineService, private readonly tenant: TenantService) {}
  @Get("timeline") timelinePage(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Query() query: { cursor?: string; limit?: string; category?: CustomerTimelineCategory; eventType?: CustomerTimelineEventType }) { return this.timeline.getTimelinePage(this.tenant.fromUser(user).organizationId, id, { ...query, limit: query.limit ? Number(query.limit) : undefined }); }
  @Get("activity") activity(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Query() query: { cursor?: string; category?: CustomerTimelineCategory }) { return this.timeline.getTimeline(this.tenant.fromUser(user).organizationId, id, query); }
  @Get("feed") feed(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Query() query: { cursor?: string; category?: CustomerTimelineCategory }) { return this.timeline.getCustomerFeed(this.tenant.fromUser(user).organizationId, id, query); }
}

