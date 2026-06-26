import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAIEmbeddingProvider } from "../embedding/providers/openai-embedding.provider";
import { RagRepository } from "./repositories/rag.repository";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";

export type RagSourceType = "document" | "website" | "faq";

export interface RagRetrievedChunk {
  chunkId: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  sourceId: string;
  sourceType: RagSourceType;
  sourceName: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  relevanceScore: number;
}

@Injectable()
export class RetrievalService {
  private readonly exactFaqCache = new Map<string, RagRetrievedChunk[]>();
  private readonly semanticCache = new Map<string, RagRetrievedChunk[]>();

  constructor(
    private readonly repository: RagRepository,
    private readonly embeddingProvider: OpenAIEmbeddingProvider,
    private readonly config: ConfigService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  async search(input: {
    organizationId: string;
    knowledgeBaseIds: string[];
    query: string;
    topK?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<RagRetrievedChunk[]> {
    const normalizedQuery = normalizeQuery(input.query);
    const cacheKey = tenantCacheKey(input.organizationId, input.knowledgeBaseIds, normalizedQuery);
    const exactCached = this.exactFaqCache.get(cacheKey);
    if (exactCached) {
      this.metrics.increment("rag_exact_faq_cache_hits");
      return exactCached;
    }
    this.metrics.increment("rag_exact_faq_cache_misses");
    const exactFaq = await this.repository.findExactFaq({
      organizationId: input.organizationId,
      knowledgeBaseIds: input.knowledgeBaseIds,
      query: normalizedQuery,
      timeoutMs: input.timeoutMs,
    });
    input.signal?.throwIfAborted();
    if (exactFaq) {
      const result = [
        {
          chunkId: exactFaq.id,
          knowledgeBaseId: exactFaq.knowledgeBaseId,
          knowledgeBaseName: "FAQ",
          sourceId: exactFaq.id,
          sourceType: "faq" as const,
          sourceName: exactFaq.question,
          chunkIndex: 0,
          chunkText: exactFaq.answer,
          tokenCount: Math.ceil(exactFaq.answer.length / 4),
          relevanceScore: 1,
        },
      ];
      remember(this.exactFaqCache, cacheKey, result);
      return result;
    }

    const semanticCached = this.semanticCache.get(cacheKey);
    if (semanticCached) {
      this.metrics.increment("rag_semantic_cache_hits");
      return semanticCached;
    }
    this.metrics.increment("rag_semantic_cache_misses");

    input.signal?.throwIfAborted();
    const embeddingStartedAt = this.metrics.now();
    const queryEmbedding = await this.embeddingProvider.generate({
      texts: [input.query],
      signal: input.signal,
    });
    this.metrics.observe("rag_embedding_ms", embeddingStartedAt);
    input.signal?.throwIfAborted();
    const vector = queryEmbedding.vectors[0] ?? [];
    const topK = input.topK ?? this.config.get<number>("rag.topK") ?? 5;
    const threshold = this.config.get<number>("rag.similarityThreshold") ?? 0.2;
    const searchStartedAt = this.metrics.now();
    const results = await this.repository.vectorSearch({
      organizationId: input.organizationId,
      knowledgeBaseIds: input.knowledgeBaseIds,
      vector,
      topK,
      threshold,
      timeoutMs: input.timeoutMs,
    });
    this.metrics.observe("rag_vector_search_ms", searchStartedAt);
    input.signal?.throwIfAborted();
    const normalized = results.map((result) => ({
      ...result,
      relevanceScore: Number(result.relevanceScore),
    }));
    remember(this.semanticCache, cacheKey, normalized);
    return normalized;
  }

  async assertKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    const knowledgeBase = await this.repository.findKnowledgeBase(organizationId, knowledgeBaseId);
    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }
    return knowledgeBase;
  }

  async assertAgent(organizationId: string, agentId: string) {
    const agent = await this.repository.findAgentWithKnowledgeBases(organizationId, agentId);
    if (!agent) {
      throw new NotFoundException("Agent not found.");
    }
    return agent;
  }
}

const MAX_CACHE_ENTRIES = 1_000;

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

function tenantCacheKey(organizationId: string, knowledgeBaseIds: string[], query: string) {
  return `${organizationId}:${[...knowledgeBaseIds].sort().join(",")}:${query}`;
}

function remember(
  cache: Map<string, RagRetrievedChunk[]>,
  key: string,
  value: RagRetrievedChunk[],
) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}
