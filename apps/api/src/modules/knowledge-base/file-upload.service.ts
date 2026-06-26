import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma";
import { StorageService } from "../storage/storage.service";
import type { TenantContext } from "../tenant/tenant.service";
import { UploadPdfDto } from "./dto/document.dto";
import { DocumentRepository } from "./repositories/document.repository";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";

const PDF_MIME_TYPE = "application/pdf";
const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

export interface UploadedPdf {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileUploadService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly storage: StorageService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
  ) {}

  async uploadPdf(context: TenantContext, input: UploadPdfDto, file?: UploadedPdf) {
    await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, input.knowledgeBaseId);
    this.validatePdf(file);
    const sizeMb = file.size / 1_048_576;
    await this.gates?.assertKnowledgeStorageCapacity(context.organizationId, sizeMb);

    const originalFileName = sanitizeOriginalFileName(file.originalname);
    const document = await this.documents.create({
      organizationId: context.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      name: stripPdfExtension(originalFileName),
      description: normalizeOptionalText(input.description),
      fileName: `${randomUUID()}.pdf`,
      originalFileName,
      fileType: PDF_MIME_TYPE,
      fileExtension: "pdf",
      fileSize: file.size,
      uploadStatus: "PENDING",
      processingStatus: "PENDING",
      uploadedBy: context.userId,
    });

    const storagePath = this.buildStoragePath(
      context.organizationId,
      input.knowledgeBaseId,
      document.id,
    );

    try {
      const upload = await this.storage.upload({
        key: storagePath,
        body: file.buffer,
        contentType: PDF_MIME_TYPE,
        contentLength: file.size,
        metadata: {
          organizationId: context.organizationId,
          knowledgeBaseId: input.knowledgeBaseId,
          documentId: document.id,
          uploadedBy: context.userId ?? "",
        },
      });

      const uploadedDocument = await this.documents.updateAndReturn(
        context.organizationId,
        document.id,
        {
          storagePath: upload.key,
          storageProvider: upload.provider,
          storageBucket: upload.bucket,
          uploadStatus: "UPLOADED",
          processingStatus: "PENDING",
        },
      );

      if (!uploadedDocument) {
        throw new InternalServerErrorException("Uploaded document metadata could not be saved.");
      }

      await this.audit(context, "pdf.uploaded", document.id, {
        knowledgeBaseId: input.knowledgeBaseId,
        fileSize: file.size,
        fileType: PDF_MIME_TYPE,
      });
      await this.usage?.increment({
        organizationId: context.organizationId,
        resourceType: "KNOWLEDGE_STORAGE_MB",
        quantity: sizeMb,
        idempotencyKey: `document:uploaded:${document.id}`,
        metadata: { knowledgeBaseId: input.knowledgeBaseId },
      });

      return this.toResponse(uploadedDocument);
    } catch (error) {
      await this.documents.update(context.organizationId, document.id, {
        uploadStatus: "FAILED",
        processingStatus: "FAILED",
      });
      await this.audit(context, "pdf.upload_failed", document.id, {
        knowledgeBaseId: input.knowledgeBaseId,
        reason: error instanceof Error ? error.message : "Unknown storage error",
      });
      throw error;
    }
  }

  private validatePdf(file?: UploadedPdf): asserts file is UploadedPdf {
    if (!file) {
      throw new BadRequestException("PDF file is required.");
    }

    if (file.size <= 0 || file.buffer.length <= 0) {
      throw new BadRequestException("Uploaded PDF is empty.");
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      throw new BadRequestException("PDF must be 25 MB or smaller.");
    }

    if (file.mimetype !== PDF_MIME_TYPE) {
      throw new BadRequestException("Only PDF files are supported.");
    }

    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      throw new BadRequestException("Uploaded file must use a .pdf extension.");
    }

    if (!file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new BadRequestException("Uploaded file is not a valid PDF.");
    }

    const tail = file.buffer.subarray(Math.max(0, file.buffer.length - 2048)).toString("latin1");
    if (!tail.includes("%%EOF")) {
      throw new BadRequestException("Uploaded PDF appears to be corrupted.");
    }
  }

  private async assertKnowledgeBaseBelongsToTenant(
    organizationId: string,
    knowledgeBaseId: string,
  ) {
    const knowledgeBase = await this.documents.knowledgeBaseExists(organizationId, knowledgeBaseId);

    if (!knowledgeBase) {
      throw new BadRequestException("Knowledge base is not available in this organization.");
    }
  }

  private buildStoragePath(
    organizationId: string,
    knowledgeBaseId: string,
    documentId: string,
  ): string {
    return `organizations/${organizationId}/knowledge-bases/${knowledgeBaseId}/documents/${documentId}.pdf`;
  }

  private toResponse(document: NonNullable<Awaited<ReturnType<DocumentRepository["findById"]>>>) {
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
      uploadedBy: document.uploader,
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

function sanitizeOriginalFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/[/\\]/g, "_");
  return normalized || `document-${randomUUID()}.pdf`;
}

function stripPdfExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").trim() || "Uploaded PDF";
}
