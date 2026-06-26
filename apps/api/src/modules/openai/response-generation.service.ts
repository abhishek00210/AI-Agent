import { Injectable, Optional, ServiceUnavailableException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { estimateTokenCount } from "../embedding/chunking.service";
import { ContextBuilderService } from "../rag/context-builder.service";
import { RetrievalService } from "../rag/retrieval.service";
import { SourceCitationService } from "../rag/source-citation.service";
import type { TenantContext } from "../tenant/tenant.service";
import type { SendChatMessageDto } from "./dto/chat.dto";
import { OpenAiProvider } from "./openai.provider";
import { PromptAssemblyService } from "./prompt-assembly.service";
import { ConversationContextService } from "./conversation-context.service";
import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { MemoryService } from "../memory/memory.service";
import { ToolExecutorService } from "../tool/tool-executor.service";
import { ToolRegistryService } from "../tool/tool-registry.service";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";
import { GreetingService } from "../customer-memory/greeting.service";

@Injectable()
export class ResponseGenerationService {
  constructor(
    private readonly contextService: ConversationContextService,
    private readonly retrieval: RetrievalService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly citations: SourceCitationService,
    private readonly promptAssembly: PromptAssemblyService,
    private readonly provider: OpenAiProvider,
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly memory: MemoryService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly toolExecutor: ToolExecutorService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly customerMemory?: CustomerMemoryContextService,
    @Optional() private readonly greetings?: GreetingService,
  ) {}

  async send(context: TenantContext, input: SendChatMessageDto & { source?: ChatMessageSource }) {
    await this.gates?.assertChatCapacity(context.organizationId, 1);
    const startedAt = Date.now();
    const messageSource = input.source ?? "CHAT_TEST";
    const conversation = await this.contextService.load({
      organizationId: context.organizationId,
      conversationId: input.conversationId,
      agentId: input.agentId,
    });

    const userMessage = await this.messages.create({
      organizationId: context.organizationId,
      conversationId: input.conversationId,
      senderType: "USER",
      content: input.message.trim(),
      messageType: "TEXT",
      tokenCount: estimateTokenCount(input.message),
      metadata: { source: messageSource },
    });
    await this.conversations.touch(
      context.organizationId,
      input.conversationId,
      userMessage.createdAt,
    );
    await this.audit(context, "message.sent", userMessage.id, {
      conversationId: input.conversationId,
      agentId: input.agentId,
    });

    const knowledgeBaseIds = conversation.agent.knowledgeBases.map(
      (knowledgeBase) => knowledgeBase.id,
    );
    const retrievedChunks =
      knowledgeBaseIds.length > 0
        ? await this.retrieval.search({
            organizationId: context.organizationId,
            knowledgeBaseIds,
            query: input.message,
          })
        : [];
    const sources = this.citations.build(retrievedChunks);
    const knowledgeContext = this.contextBuilder.build(retrievedChunks);
    const [promptMemory, customerMemory] = await Promise.all([
      this.memory.getPromptMemory(context, input.conversationId),
      this.customerMemory?.buildForConversation({
        organizationId: context.organizationId,
        conversationId: input.conversationId,
        interactionId: userMessage.id,
        channel: messageSource === "WIDGET" ? "WIDGET" : "CHAT",
      }) ?? Promise.resolve(null),
    ]);
    const shouldGreet = !conversation.messages.some((message) => message.senderType === "ASSISTANT");
    const greetingDecision =
      shouldGreet && this.greetings
        ? await this.greetings.build({
            organizationId: context.organizationId,
            interactionId: userMessage.id,
            channel: messageSource === "WIDGET" ? "WIDGET" : "CHAT",
            memory: customerMemory,
          })
        : null;
    const tools = await this.toolRegistry.availableForModel(context.organizationId);
    const response = await this.generateWithAudit(context, {
      conversationId: input.conversationId,
      agentId: input.agentId,
      source: messageSource,
      instructions: this.promptAssembly.instructions({
        systemPrompt: conversation.agent.systemPrompt,
        memorySummary: promptMemory.summary,
        memoryFacts: promptMemory.facts,
        customerMemoryContext: customerMemory?.recognized
          ? customerMemory.promptContext
          : null,
        greetingInstructions: greetingDecision?.instructions ?? null,
        knowledgeContext,
      }),
      history: conversation.messages.map((message) => ({
        senderType: message.senderType,
        content: message.content,
      })),
      currentMessage: input.message,
      tools,
    });
    const responseTime = Date.now() - startedAt;
    if (customerMemory?.recognized) {
      await this.customerMemory?.recordPromptInjection({
        organizationId: context.organizationId,
        customerProfileId: customerMemory.customer.id,
        interactionId: userMessage.id,
        channel: messageSource === "WIDGET" ? "WIDGET" : "CHAT",
      });
    }
    const assistantMessage = await this.messages.create({
      organizationId: context.organizationId,
      conversationId: input.conversationId,
      senderType: "ASSISTANT",
      content: response.content,
      messageType: "TEXT",
      tokenCount: response.tokenUsage.totalTokens || estimateTokenCount(response.content),
      metadata: {
        model: response.model,
        source: messageSource,
        responseTime,
        tokenUsage: {
          promptTokens: response.tokenUsage.promptTokens,
          completionTokens: response.tokenUsage.completionTokens,
          totalTokens: response.tokenUsage.totalTokens,
        },
        sources: sources.map((source) => ({
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          relevanceScore: source.relevanceScore,
          chunkReference: source.chunkReference,
          knowledgeBaseId: source.knowledgeBaseId,
          documentId: source.documentId,
          websiteSourceId: source.websiteSourceId,
          faqEntryId: source.faqEntryId,
        })),
        retrievalCount: retrievedChunks.length,
        knowledgeBaseIds,
        memoryUsed: Boolean(
          promptMemory.summary || promptMemory.facts.length > 0 || customerMemory?.recognized,
        ),
        memoryFactCount: promptMemory.facts.length,
        customerRecognized: Boolean(customerMemory?.recognized),
        greetingLevel: greetingDecision?.level ?? null,
        toolCalls: response.toolCalls ?? [],
      } satisfies Prisma.InputJsonObject,
    });
    await this.conversations.touch(
      context.organizationId,
      input.conversationId,
      assistantMessage.createdAt,
    );
    await this.audit(context, "ai.response_generated", assistantMessage.id, {
      conversationId: input.conversationId,
      agentId: input.agentId,
      model: response.model,
      retrievalCount: retrievedChunks.length,
      responseTime,
    });
    const usageWrites: Promise<unknown>[] = [];
    if (this.usage)
      usageWrites.push(
        this.usage.increment({
          organizationId: context.organizationId,
          resourceType: "MESSAGES",
          idempotencyKey: `ai:message:${assistantMessage.id}`,
        }),
      );
    if (this.usage && response.tokenUsage.promptTokens > 0) {
      usageWrites.push(
        this.usage.increment({
          organizationId: context.organizationId,
          resourceType: "AI_INPUT_TOKENS",
          quantity: response.tokenUsage.promptTokens,
          idempotencyKey: `ai:input-tokens:${assistantMessage.id}`,
        }),
      );
    }
    if (this.usage && response.tokenUsage.completionTokens > 0) {
      usageWrites.push(
        this.usage.increment({
          organizationId: context.organizationId,
          resourceType: "AI_OUTPUT_TOKENS",
          quantity: response.tokenUsage.completionTokens,
          idempotencyKey: `ai:output-tokens:${assistantMessage.id}`,
        }),
      );
    }
    await Promise.all(usageWrites);
    await this.analytics?.record({
      organizationId: context.organizationId,
      eventType: "AI_RESPONSE",
      idempotencyKey: `ai:response:${assistantMessage.id}`,
      agentId: input.agentId,
      metadata: {
        inputTokens: response.tokenUsage.promptTokens,
        outputTokens: response.tokenUsage.completionTokens,
      },
    });
    await this.memory.maybeEnqueueRefresh(context, input.conversationId);

    return {
      userMessage: toMessageResponse(userMessage),
      assistantMessage: toMessageResponse(assistantMessage),
      sources,
      retrievedChunks,
      tokenUsage: response.tokenUsage,
      responseTime,
      model: response.model,
      metadata: {
        retrievalCount: retrievedChunks.length,
        knowledgeBaseIds,
        memoryUsed: Boolean(
          promptMemory.summary || promptMemory.facts.length > 0 || customerMemory?.recognized,
        ),
        memoryFactCount: promptMemory.facts.length,
        customerRecognized: Boolean(customerMemory?.recognized),
        toolCalls: response.toolCalls ?? [],
      },
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.conversations.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId === "public-widget" ? undefined : context.userId,
      action,
      entityType: "Message",
      entityId,
      metadata,
    });
  }

  private async generateWithAudit(
    context: TenantContext,
    input: {
      conversationId: string;
      agentId: string;
      source: ChatMessageSource;
      instructions: string;
      history: Array<{ senderType: string; content: string }>;
      currentMessage: string;
      tools: Awaited<ReturnType<ToolRegistryService["availableForModel"]>>;
    },
  ) {
    try {
      return await this.provider.generateResponse({
        instructions: input.instructions,
        messages: this.promptAssembly.messages({
          history: input.history,
          currentMessage: input.currentMessage,
        }),
        user: context.userId,
        tools: input.tools,
        executeTool: async (toolCall) => {
          const { execution, result } = await this.toolExecutor.execute({
            toolName: toolCall.name,
            input: toolCall.arguments,
            context: {
              tenant: context,
              organizationId: context.organizationId,
              agentId: input.agentId,
              conversationId: input.conversationId,
              source: input.source === "WIDGET" ? "WIDGET" : "TEST",
            },
          });
          return {
            executionId: execution.id,
            success: result.success,
            message: result.message,
            data: "data" in result ? result.data : undefined,
          };
        },
      });
    } catch (error) {
      await this.audit(context, "openai.failure", input.conversationId, {
        conversationId: input.conversationId,
        agentId: input.agentId,
        message: error instanceof Error ? error.message : "OpenAI response generation failed.",
      });
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException("AI response generation failed. Please try again.");
    }
  }
}

type ChatMessageSource = "CHAT_TEST" | "WIDGET";

function toMessageResponse(message: {
  id: string;
  organizationId: string;
  conversationId: string;
  senderType: string;
  content: string;
  messageType: string;
  tokenCount: number;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: message.id,
    organizationId: message.organizationId,
    conversationId: message.conversationId,
    senderType: message.senderType,
    content: message.content,
    messageType: message.messageType,
    tokenCount: message.tokenCount,
    metadata: message.metadata,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}
