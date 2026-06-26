import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AgentModule } from "./modules/agent/agent.module";
import { AppointmentModule } from "./modules/appointment/appointment.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { CommunicationModule } from "./modules/communication/communication.module";
import { ConversationModule } from "./modules/conversation/conversation.module";
import { EmbeddingModule } from "./modules/embedding/embedding.module";
import { FaqModule } from "./modules/faq/faq.module";
import { HealthModule } from "./modules/health/health.module";
import { KnowledgeBaseModule } from "./modules/knowledge-base/knowledge-base.module";
import { LeadModule } from "./modules/lead/lead.module";
import { MailModule } from "./modules/mail/mail.module";
import { MemoryModule } from "./modules/memory/memory.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { OrganizationLocaleModule } from "./modules/organization-locale/organization-locale.module";
import { OpenAiModule } from "./modules/openai/openai.module";
import { RagModule } from "./modules/rag/rag.module";
import { RecordingModule } from "./modules/recording/recording.module";
import { TranscriptionModule } from "./modules/transcription/transcription.module";
import { StorageModule } from "./modules/storage/storage.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { ToolModule } from "./modules/tool/tool.module";
import { TwilioModule } from "./modules/twilio/twilio.module";
import { UserModule } from "./modules/user/user.module";
import { VoiceModule } from "./modules/voice/voice.module";
import { WebsiteScraperModule } from "./modules/website-scraper/website-scraper.module";
import { WidgetModule } from "./modules/widget/widget.module";
import { UsageModule } from "./modules/usage/usage.module";
import { envConfig, validateEnv } from "./config/env.schema";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { SecurityModule } from "./security/security.module";
import { LatencyMetricsModule } from "./common/metrics/latency-metrics.module";
import { PortRequestModule } from "./modules/port-request/port-request.module";
import { CustomerModule } from "./modules/customer/customer.module";
import { CustomerTimelineModule } from "./modules/customer-timeline/customer-timeline.module";
import { CallSummaryModule } from "./modules/call-summary/call-summary.module";
import { CustomerMemoryModule } from "./modules/customer-memory/customer-memory.module";
import { AutomationModule } from "./modules/automation/automation.module";
import { WorkflowBuilderModule } from "./modules/workflow-builder/workflow-builder.module";
import { OutboundCallModule } from "./modules/outbound-call/outbound-call.module";
import { CampaignModule } from "./modules/campaign/campaign.module";
import { E2ETestModule } from "./modules/e2e-test/e2e-test.module";
import { PerformanceModule } from "./modules/performance/performance.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      load: [envConfig],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.headers['x-twilio-signature']",
            "req.headers['x-api-key']",
            "req.body",
            "req.query",
          ],
          censor: "[REDACTED]",
        },
        serializers: {
          req: (request) => ({
            id: request.id,
            method: request.method,
            url: request.url?.split("?")[0],
          }),
        },
        autoLogging:
          process.env.HTTP_AUTO_LOGGING === "false"
            ? false
            : {
                ignore: (request) => request.url?.startsWith("/api/v1/health") ?? false,
              },
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : {
                target: "pino-pretty",
                options: { singleLine: true },
              },
      },
    }),
    DatabaseModule,
    RedisModule,
    TenantModule,
    SecurityModule,
    LatencyMetricsModule,
    AdminModule,
    AuthModule,
    UserModule,
    OrganizationLocaleModule,
    OrganizationModule,
    AgentModule,
    CommunicationModule,
    ConversationModule,
    KnowledgeBaseModule,
    LeadModule,
    OpenAiModule,
    WebsiteScraperModule,
    EmbeddingModule,
    FaqModule,
    RagModule,
    MemoryModule,
    RecordingModule,
    TranscriptionModule,
    ToolModule,
    VoiceModule,
    TwilioModule,
    MailModule,
    UsageModule,
    BillingModule,
    StorageModule,
    AnalyticsModule,
    WidgetModule,
    AppointmentModule,
    PortRequestModule,
    CustomerModule,
    CustomerTimelineModule,
    CustomerMemoryModule,
    CallSummaryModule,
    AutomationModule,
    WorkflowBuilderModule,
    OutboundCallModule,
    CampaignModule,
    E2ETestModule,
    PerformanceModule,
    HealthModule,
  ],
})
export class AppModule {}
