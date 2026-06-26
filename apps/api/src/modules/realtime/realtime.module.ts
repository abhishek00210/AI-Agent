import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { MemoryModule } from "../memory/memory.module";
import { RagModule } from "../rag/rag.module";
import { RecordingModule } from "../recording/recording.module";
import { TenantModule } from "../tenant/tenant.module";
import { ToolModule } from "../tool/tool.module";
import { TelephonyModule } from "../telephony/telephony.module";
import { RealtimeAgentContextService } from "./realtime-agent-context.service";
import { DeferredPersistenceService } from "./deferred-persistence.service";
import { RealtimeAudioBridge } from "./realtime-audio-bridge";
import { RealtimeConnectionManager } from "./realtime-connection-manager";
import { RealtimeConversationService } from "./realtime-conversation.service";
import { RealtimeController } from "./realtime.controller";
import { RealtimeEventProcessor } from "./realtime-event-processor";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeKnowledgeService } from "./realtime-knowledge.service";
import { RealtimeSessionService } from "./realtime-session.service";
import { RealtimeSessionRepository } from "./repositories/realtime-session.repository";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    RagModule,
    MemoryModule,
    TelephonyModule,
    RecordingModule,
    ToolModule,
    BillingModule,
  ],
  controllers: [RealtimeController],
  providers: [
    RealtimeGateway,
    DeferredPersistenceService,
    RealtimeSessionService,
    RealtimeConnectionManager,
    RealtimeAudioBridge,
    RealtimeConversationService,
    RealtimeAgentContextService,
    RealtimeEventProcessor,
    RealtimeKnowledgeService,
    RealtimeSessionRepository,
    ConversationRepository,
    MessageRepository,
  ],
  exports: [RealtimeGateway, RealtimeSessionService],
})
export class RealtimeModule {}
