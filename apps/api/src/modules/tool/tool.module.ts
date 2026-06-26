import { Module } from "@nestjs/common";
import { AppointmentModule } from "../appointment/appointment.module";
import { AuthModule } from "../auth/auth.module";
import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { CommunicationModule } from "../communication/communication.module";
import { LeadModule } from "../lead/lead.module";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { TenantModule } from "../tenant/tenant.module";
import { BuiltInToolsFactory } from "./builtins/built-in-tools";
import { ToolExecutionRepository } from "./repositories/tool-execution.repository";
import { ToolAuditService } from "./tool-audit.service";
import { ToolController } from "./tool.controller";
import { ToolExecutorService } from "./tool-executor.service";
import { ToolRegistryService } from "./tool-registry.service";
import { ToolService } from "./tool.service";
import { ToolValidationService } from "./tool-validation.service";

@Module({
  imports: [AuthModule, TenantModule, AppointmentModule, LeadModule, CommunicationModule],
  controllers: [ToolController],
  providers: [
    BuiltInToolsFactory,
    ToolExecutionRepository,
    ToolRegistryService,
    ToolValidationService,
    ToolAuditService,
    ToolExecutorService,
    ToolService,
    MessageRepository,
    ConversationRepository,
  ],
  exports: [ToolRegistryService, ToolExecutorService, ToolExecutionRepository],
})
export class ToolModule {}
