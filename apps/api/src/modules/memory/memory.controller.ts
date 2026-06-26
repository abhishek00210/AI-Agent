import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { MemoryService } from "./memory.service";

@UseGuards(JwtAuthGuard)
@Controller("memory")
export class MemoryController {
  constructor(
    private readonly memory: MemoryService,
    private readonly tenant: TenantService,
  ) {}

  @Get("conversation/:conversationId")
  getConversationMemory(
    @CurrentUser() user: JwtPayload,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
  ) {
    return this.memory.getConversationMemory(this.tenant.fromUser(user), conversationId);
  }

  @Post("conversation/:conversationId/refresh")
  refreshConversationMemory(
    @CurrentUser() user: JwtPayload,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
  ) {
    return this.memory.refresh(this.tenant.fromUser(user), conversationId);
  }

  @Get("conversation/:conversationId/facts")
  getFacts(
    @CurrentUser() user: JwtPayload,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
  ) {
    return this.memory.getFacts(this.tenant.fromUser(user), conversationId);
  }

  @Delete("facts/:factId")
  deleteFact(@CurrentUser() user: JwtPayload, @Param("factId", ParseUUIDPipe) factId: string) {
    return this.memory.deleteFact(this.tenant.fromUser(user), factId);
  }
}
