import { Controller, Get, Param, ParseUUIDPipe, Post, Body, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AssignPortRequestAgentDto, CreatePortRequestDto } from "./dto/port-request.dto";
import { PortRequestService } from "./port-request.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/port-requests")
export class PortRequestController {
  constructor(private readonly ports: PortRequestService, private readonly tenant: TenantService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreatePortRequestDto) {
    return this.ports.create(this.tenant.fromUser(user), body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.ports.list(this.tenant.fromUser(user));
  }

  @Get(":id")
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.ports.get(this.tenant.fromUser(user), id);
  }

  @Post(":id/loa")
  async uploadLoa(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Req() request: FastifyRequest) {
    const part = await request.file();
    const buffer = part ? await part.toBuffer() : undefined;
    return this.ports.uploadLoa(this.tenant.fromUser(user), id, part && buffer ? {
      originalname: part.filename,
      mimetype: part.mimetype,
      size: buffer.length,
      buffer,
    } : undefined);
  }

  @Get(":id/loa/download")
  downloadLoa(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.ports.loaDownload(this.tenant.fromUser(user).organizationId, id);
  }

  @Post(":id/submit")
  submit(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.ports.submit(this.tenant.fromUser(user), id);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.ports.cancel(this.tenant.fromUser(user), id);
  }

  @Post(":id/assign-agent")
  assign(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Body() body: AssignPortRequestAgentDto) {
    return this.ports.assign(this.tenant.fromUser(user), id, body);
  }
}

