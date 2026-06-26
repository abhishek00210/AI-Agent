import { Injectable } from "@nestjs/common";
import type { Prisma, ProcessingStatus, WebsiteSourceStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface ChunkWriteInput {
  organizationId: string;
  knowledgeBaseId: string;
  documentId?: string | null;
  websiteSourceId?: string | null;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  metadata: Prisma.InputJsonValue;
}

export interface EmbeddingWriteInput {
  organizationId: string;
  chunkId: string;
  embeddingModel: string;
  embeddingVector: number[];
  dimensions: number;
}

export interface ListChunksOptions {
  organizationId: string;
  knowledgeBaseId: string;
  page: number;
  limit: number;
  documentId?: string;
  websiteSourceId?: string;
  search?: string;
}

@Injectable()
export class EmbeddingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDocument(organizationId: string, documentId: string) {
    return this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        deletedAt: null,
      },
      include: {
        knowledgeBase: { select: { id: true, name: true } },
      },
    });
  }

  findWebsiteSource(organizationId: string, websiteSourceId: string) {
    return this.prisma.websiteSource.findFirst({
      where: {
        id: websiteSourceId,
        organizationId,
        deletedAt: null,
      },
      include: {
        knowledgeBase: { select: { id: true, name: true } },
        content: { select: { content: true, wordCount: true, updatedAt: true } },
      },
    });
  }

  knowledgeBaseExists(organizationId: string, knowledgeBaseId: string) {
    return this.prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  updateDocumentProcessingStatus(
    organizationId: string,
    documentId: string,
    processingStatus: ProcessingStatus,
  ) {
    return this.prisma.document.updateMany({
      where: { id: documentId, organizationId, deletedAt: null },
      data: { processingStatus },
    });
  }

  updateWebsiteSourceStatus(
    organizationId: string,
    websiteSourceId: string,
    status: WebsiteSourceStatus,
  ) {
    return this.prisma.websiteSource.updateMany({
      where: { id: websiteSourceId, organizationId, deletedAt: null },
      data: { status },
    });
  }

  async replaceDocumentChunks(
    organizationId: string,
    documentId: string,
    chunks: ChunkWriteInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: {
          organizationId,
          documentId,
        },
      });

      if (chunks.length === 0) {
        return [];
      }

      await tx.knowledgeChunk.createMany({ data: chunks });
      return tx.knowledgeChunk.findMany({
        where: { organizationId, documentId },
        orderBy: { chunkIndex: "asc" },
      });
    });
  }

  async replaceWebsiteChunks(
    organizationId: string,
    websiteSourceId: string,
    chunks: ChunkWriteInput[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: {
          organizationId,
          websiteSourceId,
        },
      });

      if (chunks.length === 0) {
        return [];
      }

      await tx.knowledgeChunk.createMany({ data: chunks });
      return tx.knowledgeChunk.findMany({
        where: { organizationId, websiteSourceId },
        orderBy: { chunkIndex: "asc" },
      });
    });
  }

  async createEmbeddings(embeddings: EmbeddingWriteInput[]) {
    if (embeddings.length === 0) {
      return { count: 0 };
    }

    return this.prisma.knowledgeEmbedding.createMany({
      data: embeddings,
    });
  }

  async listChunks(options: ListChunksOptions) {
    const where: Prisma.KnowledgeChunkWhereInput = {
      organizationId: options.organizationId,
      knowledgeBaseId: options.knowledgeBaseId,
      ...(options.documentId ? { documentId: options.documentId } : {}),
      ...(options.websiteSourceId ? { websiteSourceId: options.websiteSourceId } : {}),
      ...(options.search ? { chunkText: { contains: options.search, mode: "insensitive" } } : {}),
    };
    const skip = (options.page - 1) * options.limit;

    const [total, data] = await Promise.all([
      this.prisma.knowledgeChunk.count({ where }),
      this.prisma.knowledgeChunk.findMany({
        where,
        include: {
          embedding: {
            select: {
              id: true,
              embeddingModel: true,
              dimensions: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ chunkIndex: "asc" }],
        skip,
        take: options.limit,
      }),
    ]);

    return { total, data };
  }

  async sourceStats(
    organizationId: string,
    source: { documentId?: string; websiteSourceId?: string },
  ) {
    const where: Prisma.KnowledgeChunkWhereInput = {
      organizationId,
      ...(source.documentId ? { documentId: source.documentId } : {}),
      ...(source.websiteSourceId ? { websiteSourceId: source.websiteSourceId } : {}),
    };

    const [chunkCount, embeddingCount] = await Promise.all([
      this.prisma.knowledgeChunk.count({ where }),
      this.prisma.knowledgeEmbedding.count({
        where: {
          organizationId,
          chunk: where,
        },
      }),
    ]);

    return { chunkCount, embeddingCount };
  }

  async knowledgeBaseStats(organizationId: string, knowledgeBaseId: string) {
    const scoped = {
      organizationId,
      knowledgeBaseId,
    };

    const [
      totalDocuments,
      totalWebsites,
      totalChunks,
      totalEmbeddings,
      processedDocuments,
      failedDocuments,
      processedWebsites,
      failedWebsites,
      models,
    ] = await Promise.all([
      this.prisma.document.count({ where: { ...scoped, deletedAt: null } }),
      this.prisma.websiteSource.count({ where: { ...scoped, deletedAt: null } }),
      this.prisma.knowledgeChunk.count({ where: scoped }),
      this.prisma.knowledgeEmbedding.count({
        where: { organizationId, chunk: { knowledgeBaseId } },
      }),
      this.prisma.document.count({
        where: { ...scoped, deletedAt: null, processingStatus: "COMPLETED" },
      }),
      this.prisma.document.count({
        where: { ...scoped, deletedAt: null, processingStatus: "FAILED" },
      }),
      this.prisma.websiteSource.count({
        where: { ...scoped, deletedAt: null, status: "COMPLETED" },
      }),
      this.prisma.websiteSource.count({
        where: { ...scoped, deletedAt: null, status: "FAILED" },
      }),
      this.prisma.knowledgeEmbedding.groupBy({
        by: ["embeddingModel", "dimensions"],
        where: { organizationId, chunk: { knowledgeBaseId } },
        _count: { _all: true },
      }),
    ]);

    return {
      totalDocuments,
      totalWebsites,
      totalChunks,
      totalEmbeddings,
      processedSources: processedDocuments + processedWebsites,
      failedSources: failedDocuments + failedWebsites,
      processingStatus: deriveProcessingStatus({
        totalDocuments,
        totalWebsites,
        totalEmbeddings,
        failedDocuments,
        failedWebsites,
      }),
      models: models.map((model) => ({
        embeddingModel: model.embeddingModel,
        dimensions: model.dimensions,
        totalEmbeddings: model._count._all,
      })),
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

function deriveProcessingStatus(input: {
  totalDocuments: number;
  totalWebsites: number;
  totalEmbeddings: number;
  failedDocuments: number;
  failedWebsites: number;
}) {
  const totalSources = input.totalDocuments + input.totalWebsites;
  if (totalSources === 0) {
    return "PENDING";
  }

  if (input.totalEmbeddings > 0 && input.failedDocuments + input.failedWebsites === 0) {
    return "COMPLETED";
  }

  if (input.failedDocuments + input.failedWebsites > 0) {
    return "FAILED";
  }

  return "PENDING";
}
