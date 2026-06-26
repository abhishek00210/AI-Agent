import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CampaignSchedulerService } from "./campaign-scheduler.service";
import { CampaignService } from "./campaign.service";
import { CreateCampaignDto, ListCampaignsDto } from "./dto/campaign.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class CampaignController {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly scheduler: CampaignSchedulerService,
    private readonly tenant: TenantService,
  ) {}

  @Post("campaigns")
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateCampaignDto) {
    return this.campaigns.create(this.tenant.fromUser(user), body);
  }

  @Get("campaigns")
  list(@CurrentUser() user: JwtPayload, @Query() query: ListCampaignsDto) {
    return this.campaigns.list(this.tenant.fromUser(user), query);
  }

  @Get("campaigns/:id")
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.get(this.tenant.fromUser(user), id);
  }

  @Post("campaigns/:id/start")
  async start(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    const context = this.tenant.fromUser(user);
    const campaign = await this.campaigns.start(context, id);
    await this.scheduler.schedule(
      context.organizationId,
      id,
      campaign.status === "SCHEDULED" && campaign.scheduledAt ? new Date(campaign.scheduledAt) : new Date(),
    );
    return campaign;
  }

  @Post("campaigns/:id/pause")
  pause(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.pause(this.tenant.fromUser(user), id);
  }

  @Post("campaigns/:id/resume")
  async resume(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    const context = this.tenant.fromUser(user);
    const campaign = await this.campaigns.resume(context, id);
    await this.scheduler.schedule(context.organizationId, id);
    return campaign;
  }

  @Post("campaigns/:id/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.cancel(this.tenant.fromUser(user), id);
  }

  @Get("customers/:id/campaigns")
  customerHistory(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.campaigns.customerHistory(this.tenant.fromUser(user), id);
  }
}
