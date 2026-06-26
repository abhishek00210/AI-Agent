import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { StorageService } from "../storage/storage.service";
import type { TenantContext } from "../tenant/tenant.service";
import { ChunkingService } from "./chunking.service";
import { EmbeddingRepository } from "./repositories/embedding.repository";
import { OpenAIEmbeddingProvider } from "./providers/openai-embedding.provider";
import { PdfTextExtractionService } from "./pdf-text-extraction.service";
import type { ListChunksQueryDto } from "./dto/embedding.dto";

const EMBEDDING_BATCH_SIZE = 64;

export interface EmbeddingJobContext {
  organizationId: string;
  actorUserId?: string;
  documentId?: string;
  websiteSourceId?: string;
}

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly repository: EmbeddingRepository,
    private readonly storage: StorageService,
    private readonly chunking: ChunkingService,
    private readonly embeddings: OpenAIEmbeddingProvider,
    private readonly pdfExtractor: PdfTextExtractionService,
  ) {}

  async prepareDocumentProcessing(context: TenantContext, documentId: string) {
    const document = await this.getScopedDocument(context.organizationId, documentId);

    if (document.uploadStatus !== "UPLOADED" || !document.storagePath) {
      throw new BadRequestException("Document PDF must be uploaded before processing.");
    }

    await this.repository.updateDocumentProcessingStatus(
      context.organizationId,
      document.id,
      "PROCESSING",
    );
    await this.audit(context, "embedding.processing_started", "Document", document.id, {
      knowledgeBaseId: document.knowledgeBaseId,
    });

    return this.toDocumentStatus(document.id, "PROCESSING", {
      queued: true,
      chunkCount: 0,
      embeddingCount: 0,
    });
  }

  async prepareWebsiteProcessing(context: TenantContext, websiteSourceId: string) {
    const websiteSource = await this.getScopedWebsiteSource(
      context.organizationId,
      websiteSourceId,
    );

    if (!websiteSource.content?.content) {
      throw new BadRequestException("Website content must be scraped before processing.");
    }

    await this.repository.updateWebsiteSourceStatus(
      context.organizationId,
      websiteSource.id,
      "SCRAPING",
    );
    await this.audit(context, "embedding.processing_started", "WebsiteSource", websiteSource.id, {
      knowledgeBaseId: websiteSource.knowledgeBaseId,
    });

    return this.toWebsiteStatus(websiteSource.id, "SCRAPING", {
      queued: true,
      chunkCount: 0,
      embeddingCount: 0,
    });
  }

  async processDocumentJob(job: EmbeddingJobContext, onProgress?: (progress: number) => void) {
    if (!job.documentId) {
      return;
    }

    const document = await this.repository.findDocument(job.organizationId, job.documentId);
    if (!document || document.deletedAt) {
      return;
    }

    try {
      await this.repository.updateDocumentProcessingStatus(
        job.organizationId,
        document.id,
        "PROCESSING",
      );
      onProgress?.(15);

      if (!document.storagePath) {
        throw new BadRequestException("Document storage path is missing.");
      }

      const downloaded = await this.storage.download(document.storagePath);
      const text = await this.pdfExtractor.extract(downloaded.body);
      const chunks = this.buildChunks({
        organizationId: job.organizationId,
        knowledgeBaseId: document.knowledgeBaseId,
        documentId: document.id,
        sourceType: "document",
        content: text,
      });

      onProgress?.(40);
      const savedChunks = await this.repository.replaceDocumentChunks(
        job.organizationId,
        document.id,
        chunks,
      );
      await this.auditJob(job, "embedding.chunking_completed", "Document", document.id, {
        knowledgeBaseId: document.knowledgeBaseId,
        chunkCount: savedChunks.length,
      });

      await this.repository.updateDocumentProcessingStatus(
        job.organizationId,
        document.id,
        "EMBEDDING",
      );
      onProgress?.(55);
      await this.generateEmbeddingsForChunks(job, savedChunks);
      onProgress?.(90);

      await this.repository.updateDocumentProcessingStatus(
        job.organizationId,
        document.id,
        "COMPLETED",
      );
      await this.auditJob(job, "embedding.generated", "Document", document.id, {
        knowledgeBaseId: document.knowledgeBaseId,
        chunkCount: savedChunks.length,
      });
      onProgress?.(100);
    } catch (error) {
      await this.repository.updateDocumentProcessingStatus(
        job.organizationId,
        document.id,
        "FAILED",
      );
      await this.auditJob(job, "embedding.processing_failed", "Document", document.id, {
        knowledgeBaseId: document.knowledgeBaseId,
        reason: error instanceof Error ? error.message : "Unknown processing error",
      });
      throw error;
    }
  }

  async processWebsiteJob(job: EmbeddingJobContext, onProgress?: (progress: number) => void) {
    if (!job.websiteSourceId) {
      return;
    }

    const websiteSource = await this.repository.findWebsiteSource(
      job.organizationId,
      job.websiteSourceId,
    );
    if (!websiteSource || websiteSource.deletedAt) {
      return;
    }

    try {
      await this.repository.updateWebsiteSourceStatus(
        job.organizationId,
        websiteSource.id,
        "SCRAPING",
      );
      onProgress?.(20);

      const content = websiteSource.content?.content;
      if (!content) {
        throw new BadRequestException("Website content has not been scraped yet.");
      }

      const chunks = this.buildChunks({
        organizationId: job.organizationId,
        knowledgeBaseId: websiteSource.knowledgeBaseId,
        websiteSourceId: websiteSource.id,
        sourceType: "website",
        content,
      });
      const savedChunks = await this.repository.replaceWebsiteChunks(
        job.organizationId,
        websiteSource.id,
        chunks,
      );
      await this.auditJob(job, "embedding.chunking_completed", "WebsiteSource", websiteSource.id, {
        knowledgeBaseId: websiteSource.knowledgeBaseId,
        chunkCount: savedChunks.length,
      });

      onProgress?.(55);
      await this.generateEmbeddingsForChunks(job, savedChunks);
      onProgress?.(90);

      await this.repository.updateWebsiteSourceStatus(
        job.organizationId,
        websiteSource.id,
        "COMPLETED",
      );
      await this.auditJob(job, "embedding.generated", "WebsiteSource", websiteSource.id, {
        knowledgeBaseId: websiteSource.knowledgeBaseId,
        chunkCount: savedChunks.length,
      });
      onProgress?.(100);
    } catch (error) {
      await this.repository.updateWebsiteSourceStatus(
        job.organizationId,
        websiteSource.id,
        "FAILED",
      );
      await this.auditJob(job, "embedding.processing_failed", "WebsiteSource", websiteSource.id, {
        knowledgeBaseId: websiteSource.knowledgeBaseId,
        reason: error instanceof Error ? error.message : "Unknown processing error",
      });
      throw error;
    }
  }

  async getStatus(context: TenantContext, sourceId: string) {
    const document = await this.repository.findDocument(context.organizationId, sourceId);
    if (document) {
      const stats = await this.repository.sourceStats(context.organizationId, {
        documentId: document.id,
      });
      return this.toDocumentStatus(document.id, document.processingStatus, {
        queued: false,
        ...stats,
      });
    }

    const websiteSource = await this.repository.findWebsiteSource(context.organizationId, sourceId);
    if (websiteSource) {
      const stats = await this.repository.sourceStats(context.organizationId, {
        websiteSourceId: websiteSource.id,
      });
      return this.toWebsiteStatus(websiteSource.id, websiteSource.status, {
        queued: false,
        ...stats,
      });
    }

    throw new NotFoundException("Processing source not found.");
  }

  async stats(context: TenantContext, knowledgeBaseId: string) {
    await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, knowledgeBaseId);
    return this.repository.knowledgeBaseStats(context.organizationId, knowledgeBaseId);
  }

  async listChunks(context: TenantContext, knowledgeBaseId: string, query: ListChunksQueryDto) {
    await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, knowledgeBaseId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.repository.listChunks({
      organizationId: context.organizationId,
      knowledgeBaseId,
      page,
      limit,
      documentId: query.documentId,
      websiteSourceId: query.websiteSourceId,
      search: normalizeOptionalText(query.search) ?? undefined,
    });

    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((chunk) => ({
        id: chunk.id,
        organizationId: chunk.organizationId,
        knowledgeBaseId: chunk.knowledgeBaseId,
        documentId: chunk.documentId,
        websiteSourceId: chunk.websiteSourceId,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        tokenCount: chunk.tokenCount,
        metadata: chunk.metadata,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
        embedding: chunk.embedding,
      })),
    };
  }

  private async getScopedDocument(organizationId: string, documentId: string) {
    const document = await this.repository.findDocument(organizationId, documentId);
    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return document;
  }

  private async getScopedWebsiteSource(organizationId: string, websiteSourceId: string) {
    const websiteSource = await this.repository.findWebsiteSource(organizationId, websiteSourceId);
    if (!websiteSource) {
      throw new NotFoundException("Website source not found.");
    }

    return websiteSource;
  }

  private async assertKnowledgeBaseBelongsToTenant(
    organizationId: string,
    knowledgeBaseId: string,
  ) {
    const knowledgeBase = await this.repository.knowledgeBaseExists(
      organizationId,
      knowledgeBaseId,
    );

    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }
  }

  private buildChunks(input: {
    organizationId: string;
    knowledgeBaseId: string;
    documentId?: string;
    websiteSourceId?: string;
    sourceType: "document" | "website";
    content: string;
  }) {
    const chunks = this.chunking.chunk(input.content);

    if (chunks.length === 0) {
      throw new BadRequestException("No processable text chunks could be generated.");
    }

    return chunks.map((chunk) => ({
      organizationId: input.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId,
      websiteSourceId: input.websiteSourceId,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.chunkText,
      tokenCount: chunk.tokenCount,
      metadata: {
        sourceType: input.sourceType,
        documentId: input.documentId,
        websiteSourceId: input.websiteSourceId,
        knowledgeBaseId: input.knowledgeBaseId,
        chunkNumber: chunk.chunkIndex + 1,
      },
    }));
  }

  private async generateEmbeddingsForChunks(
    job: EmbeddingJobContext,
    chunks: Array<{ id: string; chunkText: string }>,
  ) {
    for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
      const result = await this.embeddings.generate({
        texts: batch.map((chunk) => chunk.chunkText),
        user: job.actorUserId,
      });

      await this.repository.createEmbeddings(
        batch.map((chunk, batchIndex) => ({
          organizationId: job.organizationId,
          chunkId: chunk.id,
          embeddingModel: result.model,
          embeddingVector: result.vectors[batchIndex] ?? [],
          dimensions: result.dimensions,
        })),
      );
    }
  }

  private toDocumentStatus(
    sourceId: string,
    status: string,
    stats: { queued: boolean; chunkCount: number; embeddingCount: number },
  ) {
    return {
      sourceId,
      sourceType: "document" as const,
      status,
      queued: stats.queued,
      chunkCount: stats.chunkCount,
      embeddingCount: stats.embeddingCount,
    };
  }

  private toWebsiteStatus(
    sourceId: string,
    status: string,
    stats: { queued: boolean; chunkCount: number; embeddingCount: number },
  ) {
    return {
      sourceId,
      sourceType: "website" as const,
      status,
      queued: stats.queued,
      chunkCount: stats.chunkCount,
      embeddingCount: stats.embeddingCount,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.repository.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  private auditJob(
    job: EmbeddingJobContext,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.repository.createAuditEvent({
      organizationId: job.organizationId,
      actorUserId: job.actorUserId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
