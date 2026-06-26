import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AskAgentDto, SearchKnowledgeBaseDto } from "./dto/rag.dto";
import { RagService } from "./rag.service";

@UseGuards(JwtAuthGuard)
@Controller("rag")
export class RagController {
  constructor(
    private readonly rag: RagService,
    private readonly tenant: TenantService,
  ) {}

  @Post("ask")
  ask(@CurrentUser() user: JwtPayload, @Body() body: AskAgentDto) {
    return this.rag.ask(this.tenant.fromUser(user), body);
  }

  @Post("search")
  search(@CurrentUser() user: JwtPayload, @Body() body: SearchKnowledgeBaseDto) {
    return this.rag.search(this.tenant.fromUser(user), body);
  }

  @Get("analytics/:knowledgeBaseId")
  analytics(
    @CurrentUser() user: JwtPayload,
    @Param("knowledgeBaseId", ParseUUIDPipe) knowledgeBaseId: string,
  ) {
    return this.rag.analytics(this.tenant.fromUser(user), knowledgeBaseId);
  }
}
