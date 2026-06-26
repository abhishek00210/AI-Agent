import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import {
  CreateWidgetDto,
  ListWidgetsQueryDto,
  PublicWidgetChatDto,
  PublicWidgetConversationDto,
  PublicWidgetInitDto,
  UpdateWidgetDto,
} from "./dto/widget.dto";
import { WidgetService } from "./widget.service";

@UseGuards(JwtAuthGuard)
@Controller("widgets")
export class WidgetController {
  constructor(
    private readonly widgets: WidgetService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListWidgetsQueryDto) {
    return this.widgets.list(this.tenant.fromUser(user), query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateWidgetDto) {
    return this.widgets.create(this.tenant.fromUser(user), body);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) widgetId: string) {
    return this.widgets.getById(this.tenant.fromUser(user), widgetId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) widgetId: string,
    @Body() body: UpdateWidgetDto,
  ) {
    return this.widgets.update(this.tenant.fromUser(user), widgetId, body);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) widgetId: string) {
    return this.widgets.delete(this.tenant.fromUser(user), widgetId);
  }
}

@Controller("public/widget")
export class PublicWidgetController {
  constructor(private readonly widgets: WidgetService) {}

  @Post("init")
  init(@Body() body: PublicWidgetInitDto, @Req() request: FastifyRequest) {
    return this.widgets.initialize(body, { ip: request.ip });
  }

  @Post("conversation")
  conversation(
    @Body() body: PublicWidgetConversationDto,
    @Req() request: FastifyRequest,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.widgets.createVisitorConversation(body, {
      ip: request.ip,
      userAgent,
    });
  }

  @Post("chat")
  chat(
    @Body() body: PublicWidgetChatDto,
    @Req() request: FastifyRequest,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.widgets.sendMessage(body, {
      ip: request.ip,
      userAgent,
    });
  }
}
