import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { ListToolExecutionsQueryDto, UpdateToolStatusDto } from "./dto/tool.dto";
import { ToolService } from "./tool.service";

@UseGuards(JwtAuthGuard)
@Controller("tools")
export class ToolController {
  constructor(
    private readonly tools: ToolService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.tools.listTools(this.tenant.fromUser(user));
  }

  @Get("executions")
  executions(@CurrentUser() user: JwtPayload, @Query() query: ListToolExecutionsQueryDto) {
    return this.tools.executions(this.tenant.fromUser(user), query);
  }

  @Get("stats")
  stats(@CurrentUser() user: JwtPayload) {
    return this.tools.stats(this.tenant.fromUser(user));
  }

  @Patch(":name")
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param("name") name: string,
    @Body() body: UpdateToolStatusDto,
  ) {
    return this.tools.setEnabled(this.tenant.fromUser(user), name, body.enabled);
  }
}
