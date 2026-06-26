import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AvailabilityService } from "./availability.service";
import { AvailabilitySlotsQueryDto } from "./dto/appointment.dto";
import { CreateAvailabilityDto, UpdateAvailabilityDto } from "./dto/availability.dto";

@UseGuards(JwtAuthGuard)
@Controller("availability")
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.availability.list(this.tenant.fromUser(user));
  }

  @Get("slots")
  slots(@CurrentUser() user: JwtPayload, @Query() query: AvailabilitySlotsQueryDto) {
    return this.availability.slots(this.tenant.fromUser(user), query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateAvailabilityDto) {
    return this.availability.create(this.tenant.fromUser(user), body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) availabilityId: string,
    @Body() body: UpdateAvailabilityDto,
  ) {
    return this.availability.update(this.tenant.fromUser(user), availabilityId, body);
  }
}
