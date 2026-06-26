import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class RagRepository {
  constructor(private readonly prisma: PrismaService) {}

  findKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    return this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  findAgentWithKnowledgeBases(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, deletedAt: null },
      include: {
        knowledgeBases: {
          where: { organizationId, deletedAt: null },
          select: { id: true, name: true },
        },
      },
    });
  }

  vectorSearch(input: {
    organizationId: string;
    knowledgeBaseIds: string[];
    vector: number[];
    topK: number;
    threshold: number;
    timeoutMs?: number;
  }) {
    if (input.knowledgeBaseIds.length === 0 || input.vector.length !== 1536) {
      return Promise.resolve([]);
    }
    if (input.timeoutMs && input.timeoutMs > 0) {
      return this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = ${input.timeoutMs}`;
          return runVectorSearch(tx, input);
        },
        { timeout: input.timeoutMs + 250 },
      );
    }
    return runVectorSearch(this.prisma, input);
  }

  findExactFaq(input: {
    organizationId: string;
    knowledgeBaseIds: string[];
    query: string;
    timeoutMs?: number;
  }) {
    if (input.knowledgeBaseIds.length === 0) {
      return Promise.resolve(null);
    }
    const find = (prisma: Pick<PrismaService, "faqEntry">) => prisma.faqEntry.findFirst({
      where: {
        organizationId: input.organizationId,
        knowledgeBaseId: { in: input.knowledgeBaseIds },
        status: "ACTIVE",
        deletedAt: null,
        question: { equals: input.query.trim(), mode: "insensitive" },
      },
      select: {
        id: true,
        knowledgeBaseId: true,
        question: true,
        answer: true,
        updatedAt: true,
      },
    });
    if (input.timeoutMs && input.timeoutMs > 0) {
      return this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = ${input.timeoutMs}`;
          return find(tx);
        },
        { timeout: input.timeoutMs + 250 },
      );
    }
    return find(this.prisma);
  }

  findStartupKnowledge(input: {
    organizationId: string;
    knowledgeBaseIds: string[];
    faqLimit: number;
    chunkLimit: number;
  }) {
    if (input.knowledgeBaseIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.knowledgeBase.findMany({
      where: {
        id: { in: input.knowledgeBaseIds },
        organizationId: input.organizationId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        faqEntries: {
          where: { organizationId: input.organizationId, status: "ACTIVE", deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: input.faqLimit,
          select: { id: true, question: true, answer: true, updatedAt: true },
        },
        knowledgeChunks: {
          where: { organizationId: input.organizationId },
          orderBy: { updatedAt: "desc" },
          take: input.chunkLimit,
          select: {
            id: true,
            chunkText: true,
            updatedAt: true,
            documentId: true,
            websiteSourceId: true,
            faqEntryId: true,
          },
        },
      },
    });
  }

  latestKnowledgeUpdatedAt(input: { organizationId: string; knowledgeBaseIds: string[] }) {
    if (input.knowledgeBaseIds.length === 0) {
      return Promise.resolve(null);
    }
    return this.prisma.knowledgeChunk.aggregate({
      where: {
        organizationId: input.organizationId,
        knowledgeBaseId: { in: input.knowledgeBaseIds },
      },
      _max: { updatedAt: true },
    });
  }

  createSearchEvent(input: {
    organizationId: string;
    knowledgeBaseId?: string | null;
    agentId?: string | null;
    query: string;
    source: "search" | "ask";
    resultCount: number;
    averageScore: number;
    responseTimeMs: number;
    failed?: boolean;
    usedDocumentChunks: number;
    usedWebsiteChunks: number;
    usedFaqChunks: number;
  }) {
    return this.prisma.ragSearchEvent.create({ data: input });
  }

  async analytics(organizationId: string, knowledgeBaseId: string) {
    const where: Prisma.RagSearchEventWhereInput = {
      organizationId,
      knowledgeBaseId,
    };
    const [totalSearches, events, topQueries, usage] = await Promise.all([
      this.prisma.ragSearchEvent.count({ where }),
      this.prisma.ragSearchEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.ragSearchEvent.groupBy({
        by: ["query"],
        where,
        _count: { _all: true },
        orderBy: { _count: { query: "desc" } },
        take: 10,
      }),
      this.prisma.ragSearchEvent.aggregate({
        where,
        _sum: {
          usedDocumentChunks: true,
          usedWebsiteChunks: true,
          usedFaqChunks: true,
        },
      }),
    ]);

    const averageRetrievalTime =
      events.length > 0
        ? Math.round(events.reduce((sum, event) => sum + event.responseTimeMs, 0) / events.length)
        : 0;
    const averageSimilarityScore =
      events.length > 0
        ? events.reduce((sum, event) => sum + event.averageScore, 0) / events.length
        : 0;

    return {
      totalSearches,
      averageRetrievalTime,
      averageSimilarityScore,
      failedRetrievals: events.filter((event) => event.failed).length,
      topQueries: topQueries.map((query) => ({
        query: query.query,
        count: query._count._all,
      })),
      knowledgeUsage: {
        documentChunks: usage._sum.usedDocumentChunks ?? 0,
        websiteChunks: usage._sum.usedWebsiteChunks ?? 0,
        faqChunks: usage._sum.usedFaqChunks ?? 0,
      },
    };
  }

  createAuditEvent(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }
}

function runVectorSearch(
  prisma: Pick<PrismaService, "$queryRaw">,
  input: {
    organizationId: string;
    knowledgeBaseIds: string[];
    vector: number[];
    topK: number;
    threshold: number;
  },
) {
  const vector = `[${input.vector.join(",")}]`;
  const candidateLimit = Math.max(input.topK, input.topK * 10);
  return prisma.$queryRaw<VectorSearchRow[]>`
    WITH nearest AS MATERIALIZED (
      SELECT
        embedding."chunkId",
        embedding.embedding <=> ${vector}::vector AS distance
      FROM "knowledge_embeddings" embedding
      JOIN "knowledge_chunks" candidate_chunk
        ON candidate_chunk.id = embedding."chunkId"
      WHERE embedding."organizationId" = ${input.organizationId}
        AND candidate_chunk."organizationId" = ${input.organizationId}
        AND candidate_chunk."knowledgeBaseId" IN (${Prisma.join(input.knowledgeBaseIds)})
        AND embedding.embedding IS NOT NULL
      ORDER BY embedding.embedding <=> ${vector}::vector
      LIMIT ${candidateLimit}
    )
    SELECT
      chunk.id AS "chunkId",
      chunk."knowledgeBaseId",
      kb.name AS "knowledgeBaseName",
      chunk."chunkIndex",
      chunk."chunkText",
      chunk."tokenCount",
      COALESCE(document.id, website.id, faq.id) AS "sourceId",
      CASE
        WHEN document.id IS NOT NULL THEN 'document'
        WHEN website.id IS NOT NULL THEN 'website'
        ELSE 'faq'
      END AS "sourceType",
      COALESCE(
        NULLIF(document.name, ''),
        document."originalFileName",
        NULLIF(website.title, ''),
        website.url,
        faq.question
      ) AS "sourceName",
      1 - nearest.distance AS "relevanceScore"
    FROM nearest
    JOIN "knowledge_chunks" chunk ON chunk.id = nearest."chunkId"
    JOIN "knowledge_bases" kb ON kb.id = chunk."knowledgeBaseId"
    LEFT JOIN documents document
      ON document.id = chunk."documentId" AND document."deletedAt" IS NULL
    LEFT JOIN website_sources website
      ON website.id = chunk."websiteSourceId"
      AND website."deletedAt" IS NULL AND website.status = 'COMPLETED'
    LEFT JOIN faq_entries faq
      ON faq.id = chunk."faqEntryId"
      AND faq."deletedAt" IS NULL AND faq.status = 'ACTIVE'
    WHERE chunk."organizationId" = ${input.organizationId}
      AND chunk."knowledgeBaseId" IN (${Prisma.join(input.knowledgeBaseIds)})
      AND (document.id IS NOT NULL OR website.id IS NOT NULL OR faq.id IS NOT NULL)
      AND 1 - nearest.distance >= ${input.threshold}
    ORDER BY nearest.distance, chunk.id
    LIMIT ${input.topK}
  `;
}

export interface VectorSearchRow {
  chunkId: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  sourceId: string;
  sourceType: "document" | "website" | "faq";
  sourceName: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  relevanceScore: number;
}
