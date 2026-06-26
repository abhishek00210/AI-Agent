import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import {
  AssignAgentDto,
  CreateKnowledgeBaseDto,
  ListKnowledgeBasesQueryDto,
  UpdateKnowledgeBaseDto,
} from "./dto/knowledge-base.dto";
import { KnowledgeBaseService } from "./knowledge-base.service";

@UseGuards(JwtAuthGuard)
@Controller("knowledge-bases")
export class KnowledgeBaseController {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly tenant: TenantService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateKnowledgeBaseDto) {
    return this.knowledgeBaseService.create(this.tenant.fromUser(user), body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListKnowledgeBasesQueryDto) {
    return this.knowledgeBaseService.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) knowledgeBaseId: string) {
    return this.knowledgeBaseService.getById(this.tenant.fromUser(user), knowledgeBaseId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) knowledgeBaseId: string,
    @Body() body: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeBaseService.update(this.tenant.fromUser(user), knowledgeBaseId, body);
  }

  @Patch(":id/assign-agent")
  assignAgent(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) knowledgeBaseId: string,
    @Body() body: AssignAgentDto,
  ) {
    return this.knowledgeBaseService.assignAgent(this.tenant.fromUser(user), knowledgeBaseId, body);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) knowledgeBaseId: string) {
    return this.knowledgeBaseService.delete(this.tenant.fromUser(user), knowledgeBaseId);
  }
}
