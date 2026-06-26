import {
  Body,
  Controller,
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
import { CommunicationThreadService } from "./communication-thread.service";
import { CommunicationService } from "./communication.service";
import { ListCommunicationsDto, SendCommunicationDto } from "./dto/communication.dto";
import { RetryService } from "./retry.service";
import { SmsQueueService } from "./sms-queue.service";

@UseGuards(JwtAuthGuard)
@Controller("communications")
export class CommunicationController {
  constructor(
    private readonly communications: CommunicationService,
    private readonly threads: CommunicationThreadService,
    private readonly retryService: RetryService,
    private readonly queue: SmsQueueService,
    private readonly tenant: TenantService,
  ) {}

  @Get("threads")
  listThreads(@CurrentUser() user: JwtPayload, @Query() query: ListCommunicationsDto) {
    const context = this.tenant.fromUser(user);
    return this.threads.list(context.organizationId, query.page, query.limit);
  }

  @Get("threads/:id")
  thread(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.threads.details(this.tenant.fromUser(user).organizationId, id);
  }

  @Get("messages")
  messages(@CurrentUser() user: JwtPayload, @Query() query: ListCommunicationsDto) {
    return this.communications.listMessages(this.tenant.fromUser(user), query);
  }

  @Get("messages/:id")
  message(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.communications.getMessage(this.tenant.fromUser(user), id);
  }

  @Post("send")
  send(@CurrentUser() user: JwtPayload, @Body() input: SendCommunicationDto) {
    return this.communications.send(this.tenant.fromUser(user), input);
  }

  @Post("messages/:id/retry")
  retry(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.retryService.retry(this.tenant.fromUser(user), id);
  }

  @Get("queue")
  queueStatus() {
    return this.queue.depth();
  }
}
