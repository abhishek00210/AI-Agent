import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import {
  InviteMemberDto,
  UpdateGreetingSettingsDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
} from "./dto/organization.dto";
import { OrganizationService } from "./organization.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("organizations")
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly tenant: TenantService,
  ) {}

  @Get("current")
  current(@CurrentUser() user: JwtPayload) {
    return this.organizationService.getCurrent(this.tenant.fromUser(user));
  }

  @Roles("OWNER", "ADMIN")
  @Patch("current")
  updateCurrent(@CurrentUser() user: JwtPayload, @Body() body: UpdateOrganizationDto) {
    return this.organizationService.updateCurrent(this.tenant.fromUser(user), body);
  }

  @Get("greeting-settings")
  greetingSettings(@CurrentUser() user: JwtPayload) {
    return this.organizationService.greetingSettings(this.tenant.fromUser(user));
  }

  @Roles("OWNER", "ADMIN")
  @Patch("greeting-settings")
  updateGreetingSettings(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateGreetingSettingsDto,
  ) {
    return this.organizationService.updateGreetingSettings(this.tenant.fromUser(user), body);
  }

  @Get("members")
  members(@CurrentUser() user: JwtPayload) {
    return this.organizationService.listMembers(this.tenant.fromUser(user));
  }

  @Roles("OWNER", "ADMIN")
  @Post("members")
  inviteMember(@CurrentUser() user: JwtPayload, @Body() body: InviteMemberDto) {
    return this.organizationService.inviteMember(this.tenant.fromUser(user), body);
  }

  @Roles("OWNER", "ADMIN")
  @Patch("members/:id")
  updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param("id") memberId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.organizationService.updateMemberRole(this.tenant.fromUser(user), memberId, body);
  }

  @Roles("OWNER", "ADMIN")
  @Delete("members/:id")
  removeMember(@CurrentUser() user: JwtPayload, @Param("id") memberId: string) {
    return this.organizationService.removeMember(this.tenant.fromUser(user), memberId);
  }
}
