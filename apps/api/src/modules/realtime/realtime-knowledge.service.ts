import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { RagRepository } from "../rag/repositories/rag.repository";
import { RetrievalService } from "../rag/retrieval.service";
import type { AiToolDefinition } from "../tool/tool.types";
import type { RealtimeAgentContext } from "./realtime.types";

export const SEARCH_KNOWLEDGE_TOOL: AiToolDefinition = {
  type: "function",
  name: "search_knowledge",
  description:
    "Search the business knowledge base for deeper factual details such as services, hours, policies, pricing, FAQs, or source-backed answers. Use only when the answer is not already clear from the conversation or startup context.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A concise natural-language search query for business knowledge.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

interface StartupCacheEntry {
  version: string;
  context: string;
}

@Injectable()
export class RealtimeKnowledgeService {
  private readonly logger = new Logger(RealtimeKnowledgeService.name);
  private readonly startupCache = new Map<string, StartupCacheEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly ragRepository: RagRepository,
    private readonly retrieval: RetrievalService,
    private readonly metrics: RealtimeMetricsService,
  ) {}

  toolFor(context: RealtimeAgentContext): AiToolDefinition[] {
    return context.knowledgeBaseIds.length > 0 ? [SEARCH_KNOWLEDGE_TOOL] : [];
  }

  async startupContext(context: RealtimeAgentContext) {
    if (context.knowledgeBaseIds.length === 0) {
      return { text: "", warm: true };
    }

    const startedAt = this.metrics.now();
    const budget = configuredNumber(
      this.config,
      "openai.realtimeStartupKnowledgeBudgetChars",
      2_000,
    );
    const version = await this.knowledgeVersion(context);
    const cacheKey = `${context.organizationId}:${context.agentId}:${[...context.knowledgeBaseIds]
      .sort()
      .join(",")}:${budget}`;
    const cached = this.startupCache.get(cacheKey);
    if (cached?.version === version) {
      this.metrics.increment("startup_knowledge_cache_hits");
      this.metrics.observe("startup_context_warm_ms", startedAt);
      return { text: cached.context, warm: true };
    }

    this.metrics.increment("startup_knowledge_cache_misses");
    const rows = await this.ragRepository.findStartupKnowledge({
      organizationId: context.organizationId,
      knowledgeBaseIds: context.knowledgeBaseIds,
      faqLimit: configuredNumber(this.config, "openai.realtimeStartupFaqLimit", 8),
      chunkLimit: configuredNumber(this.config, "openai.realtimeStartupChunkLimit", 8),
    });
    const text = buildStartupKnowledge(rows, budget);
    this.rememberStartup(cacheKey, { version, context: text });
    this.metrics.observe("startup_context_cold_ms", startedAt);
    return { text, warm: false };
  }

  async search(context: RealtimeAgentContext, input: unknown) {
    const query = parseSearchQuery(input);
    if (!query || context.knowledgeBaseIds.length === 0) {
      return {
        success: false,
        message: "Knowledge is unavailable for this call.",
        chunks: [],
      };
    }

    const timeoutMs = configuredNumber(this.config, "openai.realtimeRagTimeoutMs", 350);
    const startedAt = this.metrics.now();
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), timeoutMs);
    timeout.unref?.();
    try {
      const chunks = await this.retrieval.search({
        organizationId: context.organizationId,
        knowledgeBaseIds: context.knowledgeBaseIds,
        query,
        topK: Math.min(3, Math.max(1, configuredNumber(this.config, "openai.realtimeRagTopK", 3))),
        timeoutMs,
        signal: abort.signal,
      });
      this.metrics.observe("rag_total_ms", startedAt);
      this.metrics.increment("realtime_rag_success");
      return {
        success: true,
        message: chunks.length > 0 ? "Knowledge search completed." : "No matching knowledge found.",
        chunks: chunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          sourceId: chunk.sourceId,
          sourceType: chunk.sourceType,
          sourceName: chunk.sourceName,
          knowledgeBaseId: chunk.knowledgeBaseId,
          relevanceScore: chunk.relevanceScore,
          text: chunk.chunkText,
        })),
      };
    } catch (error) {
      const timedOut = abort.signal.aborted;
      this.metrics.observe("rag_total_ms", startedAt, false);
      this.metrics.increment(timedOut ? "realtime_rag_cancellations" : "realtime_rag_failures");
      if (timedOut) {
        this.metrics.increment("realtime_rag_timeouts");
      }
      this.logger.warn(
        timedOut
          ? `Realtime knowledge search timed out after ${timeoutMs}ms.`
          : `Realtime knowledge search failed: ${readError(error)}`,
      );
      return {
        success: false,
        message: "Knowledge is temporarily unavailable. Continue the conversation without it.",
        chunks: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async knowledgeVersion(context: RealtimeAgentContext) {
    const result = await this.ragRepository.latestKnowledgeUpdatedAt({
      organizationId: context.organizationId,
      knowledgeBaseIds: context.knowledgeBaseIds,
    });
    return [
      context.agentUpdatedAt ?? "",
      result?._max.updatedAt?.toISOString() ?? "",
      ...(context.knowledgeBaseUpdatedAt ?? []),
    ].join("|");
  }

  private rememberStartup(key: string, entry: StartupCacheEntry) {
    if (this.startupCache.size >= 500) {
      const oldest = this.startupCache.keys().next().value as string | undefined;
      if (oldest) this.startupCache.delete(oldest);
    }
    this.startupCache.set(key, entry);
  }
}

function buildStartupKnowledge(
  rows: Array<{
    name: string;
    description: string | null;
    faqEntries: Array<{ question: string; answer: string }>;
    knowledgeChunks: Array<{ chunkText: string }>;
  }>,
  budget: number,
) {
  const sections: string[] = [];
  for (const kb of rows) {
    sections.push(`Knowledge base: ${kb.name}`);
    if (kb.description) sections.push(`Summary: ${kb.description}`);
    for (const faq of kb.faqEntries) {
      sections.push(`FAQ: ${faq.question}\nAnswer: ${faq.answer}`);
    }
    for (const chunk of kb.knowledgeChunks) {
      sections.push(`Fact: ${chunk.chunkText}`);
    }
  }
  const text = sections.join("\n\n").slice(0, Math.max(0, budget));
  if (!text) return "";
  return [
    "Compact business knowledge available at call start:",
    text,
    "For deeper or source-specific facts, call search_knowledge with a concise query.",
  ].join("\n\n");
}

function parseSearchQuery(input: unknown) {
  const value = input as { query?: unknown };
  return typeof value?.query === "string" ? value.query.trim().slice(0, 500) : "";
}

function configuredNumber(config: ConfigService, key: string, fallback: number): number {
  const value = config.get<number>(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
