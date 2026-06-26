import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { SendChatMessageDto } from "./dto/chat.dto";
import { ResponseGenerationService } from "./response-generation.service";

@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(
    private readonly responses: ResponseGenerationService,
    private readonly tenant: TenantService,
  ) {}

  @Post("send")
  send(@CurrentUser() user: JwtPayload, @Body() body: SendChatMessageDto) {
    return this.responses.send(this.tenant.fromUser(user), body);
  }
}
