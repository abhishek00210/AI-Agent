import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CallSessionService } from "./call-session.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/calls/:callId/sessions")
export class CallSessionController {
  constructor(
    private readonly sessions: CallSessionService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param("callId", ParseUUIDPipe) callId: string) {
    return this.sessions.listForCall(this.tenant.fromUser(user), callId);
  }
}
