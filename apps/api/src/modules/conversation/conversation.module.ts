import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { ConversationAnalyticsService } from "./conversation-analytics.service";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { MessageService } from "./message.service";
import { ConversationRepository } from "./repositories/conversation.repository";
import { MessageRepository } from "./repositories/message.repository";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [ConversationController],
  providers: [
    ConversationService,
    MessageService,
    ConversationAnalyticsService,
    ConversationRepository,
    MessageRepository,
  ],
})
export class ConversationModule {}
