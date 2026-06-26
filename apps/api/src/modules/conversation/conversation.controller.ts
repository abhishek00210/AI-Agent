import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { ConversationAnalyticsService } from "./conversation-analytics.service";
import { ConversationService } from "./conversation.service";
import {
  CreateConversationDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  SendMessageDto,
} from "./dto/conversation.dto";
import { MessageService } from "./message.service";

@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
    private readonly analyticsService: ConversationAnalyticsService,
    private readonly tenant: TenantService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateConversationDto) {
    return this.conversations.create(this.tenant.fromUser(user), body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListConversationsQueryDto) {
    return this.conversations.list(this.tenant.fromUser(user), query);
  }

  @Get("analytics")
  analytics(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.overview(this.tenant.fromUser(user));
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) conversationId: string) {
    return this.conversations.getById(this.tenant.fromUser(user), conversationId);
  }

  @Post(":id/close")
  close(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) conversationId: string) {
    return this.conversations.close(this.tenant.fromUser(user), conversationId);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) conversationId: string) {
    return this.conversations.archive(this.tenant.fromUser(user), conversationId);
  }

  @Delete(":id")
  delete(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) conversationId: string) {
    return this.conversations.delete(this.tenant.fromUser(user), conversationId);
  }

  @Post(":id/messages")
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.messages.sendUserMessage(this.tenant.fromUser(user), conversationId, body);
  }

  @Get(":id/messages")
  listMessages(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messages.list(this.tenant.fromUser(user), conversationId, query);
  }
}
