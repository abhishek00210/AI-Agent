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
import { AgentService } from "./agent.service";
import { CreateAgentDto, ListAgentsQueryDto, UpdateAgentDto } from "./dto/agent.dto";

@UseGuards(JwtAuthGuard)
@Controller("agents")
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly tenant: TenantService,
  ) {}

  @Get("capabilities")
  capabilities() {
    return this.agentService.capabilities();
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateAgentDto) {
    return this.agentService.create(this.tenant.fromUser(user), body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListAgentsQueryDto) {
    return this.agentService.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) agentId: string) {
    return this.agentService.getById(this.tenant.fromUser(user), agentId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) agentId: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agentService.update(this.tenant.fromUser(user), agentId, body);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) agentId: string) {
    return this.agentService.delete(this.tenant.fromUser(user), agentId);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) agentId: string) {
    return this.agentService.duplicate(this.tenant.fromUser(user), agentId);
  }
}
