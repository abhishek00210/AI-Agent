import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Prisma, ProcessingStatus, UploadStatus } from "../../../generated/prisma";
import { StorageService } from "../storage/storage.service";
import type { TenantContext } from "../tenant/tenant.service";
import type {
  CreateDocumentDto,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
} from "./dto/document.dto";
import { DocumentRepository } from "./repositories/document.repository";
import { UsageService } from "../usage/usage.service";

@Injectable()
export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly storage: StorageService,
    @Optional() private readonly usage?: UsageService,
  ) {}

  async create(context: TenantContext, input: CreateDocumentDto) {
    await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, input.knowledgeBaseId);

    const document = await this.documents.create({
      organizationId: context.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      name: input.name.trim(),
      description: normalizeOptionalText(input.description),
      uploadStatus: "PENDING",
      processingStatus: "PENDING",
    });

    await this.audit(context, "document.created", document.id, {
      name: document.name,
      knowledgeBaseId: document.knowledgeBaseId,
    });

    return this.toResponse(document);
  }

  async list(context: TenantContext, query: ListDocumentsQueryDto) {
    if (query.knowledgeBaseId) {
      await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, query.knowledgeBaseId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const result = await this.documents.list({
      organizationId: context.organizationId,
      page,
      limit,
      knowledgeBaseId: query.knowledgeBaseId,
      search: normalizeOptionalText(query.search) ?? undefined,
      uploadStatus: query.uploadStatus as UploadStatus | undefined,
      processingStatus: query.processingStatus as ProcessingStatus | undefined,
    });

    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((document) => this.toResponse(document)),
    };
  }

  async getById(context: TenantContext, documentId: string) {
    const document = await this.getScopedDocument(context.organizationId, documentId);
    return this.toResponse(document);
  }

  async update(context: TenantContext, documentId: string, input: UpdateDocumentDto) {
    const existing = await this.getScopedDocument(context.organizationId, documentId);

    await this.documents.update(context.organizationId, documentId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalText(input.description) }
        : {}),
      ...(input.uploadStatus !== undefined
        ? { uploadStatus: input.uploadStatus as UploadStatus }
        : {}),
      ...(input.processingStatus !== undefined
        ? { processingStatus: input.processingStatus as ProcessingStatus }
        : {}),
    });
    const document = await this.getScopedDocument(context.organizationId, documentId);

    await this.audit(context, "document.updated", document.id, {
      before: {
        name: existing.name,
        uploadStatus: existing.uploadStatus,
        processingStatus: existing.processingStatus,
      },
      after: {
        name: document.name,
        uploadStatus: document.uploadStatus,
        processingStatus: document.processingStatus,
      },
    });

    return this.toResponse(document);
  }

  async delete(context: TenantContext, documentId: string) {
    const document = await this.getScopedDocument(context.organizationId, documentId);

    if (document.storagePath) {
      await this.storage.delete(document.storagePath);
    }

    await this.documents.softDelete(context.organizationId, documentId);
    await this.audit(
      context,
      document.storagePath ? "pdf.deleted" : "document.deleted",
      document.id,
      {
        name: document.name,
        knowledgeBaseId: document.knowledgeBaseId,
        fileName: document.originalFileName,
      },
    );
    if (document.uploadStatus === "UPLOADED" && document.fileSize) {
      await this.usage?.decrement({
        organizationId: context.organizationId,
        resourceType: "KNOWLEDGE_STORAGE_MB",
        quantity: document.fileSize / 1_048_576,
        idempotencyKey: `document:deleted:${document.id}`,
      });
    }

    return { success: true };
  }

  async createDownloadAccess(context: TenantContext, documentId: string) {
    const document = await this.getScopedDocument(context.organizationId, documentId);

    if (!document.storagePath || document.uploadStatus !== "UPLOADED") {
      throw new BadRequestException("Document file is not available for download.");
    }

    const access = await this.storage.createDownloadUrl(
      document.storagePath,
      document.originalFileName ?? document.fileName ?? `${document.name}.pdf`,
    );

    await this.audit(context, "pdf.downloaded", document.id, {
      name: document.name,
      knowledgeBaseId: document.knowledgeBaseId,
    });

    return access;
  }

  private async getScopedDocument(organizationId: string, documentId: string) {
    const document = await this.documents.findById(organizationId, documentId);

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return document;
  }

  private async assertKnowledgeBaseBelongsToTenant(
    organizationId: string,
    knowledgeBaseId: string,
  ) {
    const knowledgeBase = await this.documents.knowledgeBaseExists(organizationId, knowledgeBaseId);

    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }
  }

  private toResponse(document: {
    id: string;
    organizationId: string;
    knowledgeBaseId: string;
    name: string;
    description: string | null;
    fileName: string | null;
    originalFileName: string | null;
    fileType: string | null;
    fileExtension: string | null;
    fileSize: number | null;
    storagePath: string | null;
    storageProvider: string | null;
    storageBucket: string | null;
    uploadStatus: UploadStatus;
    processingStatus: ProcessingStatus;
    uploadedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    knowledgeBase?: { id: string; name: string };
    uploader?: { id: string; email: string; firstName: string; lastName: string } | null;
  }) {
    return {
      id: document.id,
      organizationId: document.organizationId,
      knowledgeBaseId: document.knowledgeBaseId,
      knowledgeBase: document.knowledgeBase,
      name: document.name,
      description: document.description,
      fileName: document.fileName,
      originalFileName: document.originalFileName,
      fileType: document.fileType,
      fileExtension: document.fileExtension,
      fileSize: document.fileSize,
      storageProvider: document.storageProvider,
      uploadStatus: document.uploadStatus,
      processingStatus: document.processingStatus,
      uploadedBy: document.uploader ?? null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.documents.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "Document",
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
