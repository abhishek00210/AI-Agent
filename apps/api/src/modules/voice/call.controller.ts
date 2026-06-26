import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CallExportService } from "./call-export.service";
import { CallLogService } from "./call-log.service";
import { ExportCallsQueryDto, ListCallsQueryDto } from "./dto/call.dto";

@UseGuards(JwtAuthGuard)
@Controller("voice/calls")
export class CallController {
  constructor(
    private readonly calls: CallLogService,
    private readonly exports: CallExportService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListCallsQueryDto) {
    return this.calls.list(this.tenant.fromUser(user), query);
  }

  @Get("export")
  async export(
    @CurrentUser() user: JwtPayload,
    @Query() query: ExportCallsQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const context = this.tenant.fromUser(user);
    const result = await this.exports.export(context, query);
    reply.header("Content-Type", result.contentType);
    reply.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return result.stream;
  }

  @Get(":id/timeline")
  timeline(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) callId: string) {
    return this.calls.timeline(this.tenant.fromUser(user), callId);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) callId: string) {
    return this.calls.getById(this.tenant.fromUser(user), callId);
  }
}
