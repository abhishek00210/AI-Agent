import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { MemoryModule } from "../memory/memory.module";
import { RagModule } from "../rag/rag.module";
import { TenantModule } from "../tenant/tenant.module";
import { ToolModule } from "../tool/tool.module";
import { ChatController } from "./chat.controller";
import { ConversationContextService } from "./conversation-context.service";
import { OpenAiConfigService } from "./openai-config.service";
import { OpenAiProvider } from "./openai.provider";
import { PromptAssemblyService } from "./prompt-assembly.service";
import { ResponseGenerationService } from "./response-generation.service";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AuthModule, TenantModule, RagModule, MemoryModule, ToolModule, BillingModule],
  controllers: [ChatController],
  providers: [
    OpenAiConfigService,
    OpenAiProvider,
    PromptAssemblyService,
    ConversationContextService,
    ResponseGenerationService,
    ConversationRepository,
    MessageRepository,
  ],
  exports: [OpenAiProvider, OpenAiConfigService, ResponseGenerationService],
})
export class OpenAiModule {}
