import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { AnswerGenerationService } from "./answer-generation.service";
import { ContextBuilderService } from "./context-builder.service";
import type { AskAgentDto, SearchKnowledgeBaseDto } from "./dto/rag.dto";
import { RagRepository } from "./repositories/rag.repository";
import type { RagRetrievedChunk } from "./retrieval.service";
import { RetrievalService } from "./retrieval.service";
import { SourceCitationService } from "./source-citation.service";

@Injectable()
export class RagService {
  constructor(
    private readonly repository: RagRepository,
    private readonly retrieval: RetrievalService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly answerGeneration: AnswerGenerationService,
    private readonly citations: SourceCitationService,
  ) {}

  async ask(context: TenantContext, input: AskAgentDto) {
    const startedAt = Date.now();
    const agent = await this.retrieval.assertAgent(context.organizationId, input.agentId);
    const knowledgeBaseIds = agent.knowledgeBases.map((knowledgeBase) => knowledgeBase.id);

    if (knowledgeBaseIds.length === 0) {
      throw new BadRequestException("Assign at least one knowledge base to this agent first.");
    }

    const chunks = await this.retrieval.search({
      organizationId: context.organizationId,
      knowledgeBaseIds,
      query: input.question,
      topK: input.topK,
    });
    const answer = await this.answerGeneration.generate({
      question: input.question,
      context: this.contextBuilder.build(chunks),
      agentSystemPrompt: agent.systemPrompt,
    });
    const responseTimeMs = Date.now() - startedAt;

    await this.recordSearch(context, {
      agentId: agent.id,
      knowledgeBaseId: knowledgeBaseIds.length === 1 ? knowledgeBaseIds[0] : null,
      query: input.question,
      source: "ask",
      chunks,
      responseTimeMs,
    });
    await this.audit(context, "rag.agent_asked", agent.id, {
      knowledgeBaseIds,
      resultCount: chunks.length,
      responseTimeMs,
    });

    return {
      answer,
      sources: this.citations.build(chunks),
      retrievedChunks: chunks,
      confidence: averageScore(chunks),
      metadata: {
        retrievalTimeMs: responseTimeMs,
        resultCount: chunks.length,
        knowledgeBaseIds,
      },
    };
  }

  async search(context: TenantContext, input: SearchKnowledgeBaseDto) {
    const startedAt = Date.now();
    const knowledgeBase = await this.retrieval.assertKnowledgeBase(
      context.organizationId,
      input.knowledgeBaseId,
    );
    const chunks = await this.retrieval.search({
      organizationId: context.organizationId,
      knowledgeBaseIds: [knowledgeBase.id],
      query: input.query,
      topK: input.topK,
    });
    const answer = await this.answerGeneration.generate({
      question: input.query,
      context: this.contextBuilder.build(chunks),
      agentSystemPrompt:
        "You are a knowledge base assistant. Answer only from the supplied tenant-scoped context.",
    });
    const responseTimeMs = Date.now() - startedAt;

    await this.recordSearch(context, {
      knowledgeBaseId: knowledgeBase.id,
      query: input.query,
      source: "search",
      chunks,
      responseTimeMs,
    });
    await this.audit(context, "rag.knowledge_searched", knowledgeBase.id, {
      resultCount: chunks.length,
      responseTimeMs,
    });

    return {
      query: input.query,
      answer,
      results: chunks,
      sources: this.citations.build(chunks),
      confidence: averageScore(chunks),
      retrievalTimeMs: responseTimeMs,
    };
  }

  async analytics(context: TenantContext, knowledgeBaseId: string) {
    await this.retrieval.assertKnowledgeBase(context.organizationId, knowledgeBaseId);
    return this.repository.analytics(context.organizationId, knowledgeBaseId);
  }

  private async recordSearch(
    context: TenantContext,
    input: {
      knowledgeBaseId?: string | null;
      agentId?: string | null;
      query: string;
      source: "search" | "ask";
      chunks: RagRetrievedChunk[];
      responseTimeMs: number;
    },
  ) {
    const usage = sourceUsage(input.chunks);
    await this.repository.createSearchEvent({
      organizationId: context.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      agentId: input.agentId,
      query: input.query,
      source: input.source,
      resultCount: input.chunks.length,
      averageScore: averageScore(input.chunks),
      responseTimeMs: input.responseTimeMs,
      failed: input.chunks.length === 0,
      ...usage,
    });
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.repository.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "RagSearch",
      entityId,
      metadata,
    });
  }
}

function averageScore(chunks: RagRetrievedChunk[]): number {
  if (chunks.length === 0) {
    return 0;
  }
  return chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / chunks.length;
}

function sourceUsage(chunks: RagRetrievedChunk[]) {
  return {
    usedDocumentChunks: chunks.filter((chunk) => chunk.sourceType === "document").length,
    usedWebsiteChunks: chunks.filter((chunk) => chunk.sourceType === "website").length,
    usedFaqChunks: chunks.filter((chunk) => chunk.sourceType === "faq").length,
  };
}
