import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { VoiceService } from "./voice.service";

@UseGuards(JwtAuthGuard)
@Controller("voice")
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly tenant: TenantService,
  ) {}

  @Get("capabilities")
  capabilities() {
    return this.voiceService.capabilities();
  }

  @Get("dashboard")
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.voiceService.dashboard(this.tenant.fromUser(user));
  }
}
