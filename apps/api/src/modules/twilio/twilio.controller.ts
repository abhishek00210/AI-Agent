import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { TwilioConnectionService } from "./twilio-connection.service";
import { TwilioService } from "./twilio.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/twilio")
export class TwilioController {
  constructor(
    private readonly twilioService: TwilioService,
    private readonly connections: TwilioConnectionService,
    private readonly tenant: TenantService,
  ) {}

  @Get("capabilities")
  capabilities() {
    return this.twilioService.describe();
  }

  @Post("verify")
  verify(@CurrentUser() user: JwtPayload) {
    return this.connections.verify(this.tenant.fromUser(user));
  }

  @Get("status")
  status(@CurrentUser() user: JwtPayload) {
    return this.connections.status(this.tenant.fromUser(user));
  }
}
