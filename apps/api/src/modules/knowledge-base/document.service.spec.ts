import { NotFoundException } from "@nestjs/common";
import { DocumentService } from "./document.service";
import { ProcessingStatusDto, UploadStatusDto } from "./dto/document.dto";
import type { DocumentRepository } from "./repositories/document.repository";
import type { StorageService } from "../storage/storage.service";
import type { TenantContext } from "../tenant/tenant.service";

const context: TenantContext = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER",
};

const now = new Date("2026-06-08T00:00:00.000Z");

const document = {
  id: "doc-1",
  organizationId: "org-1",
  knowledgeBaseId: "kb-1",
  name: "Pricing FAQ",
  description: "Pricing answers",
  fileName: null,
  originalFileName: null,
  fileType: null,
  fileExtension: null,
  fileSize: null,
  storagePath: null,
  storageProvider: null,
  storageBucket: null,
  uploadStatus: "PENDING" as const,
  processingStatus: "PENDING" as const,
  uploadedBy: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  knowledgeBase: {
    id: "kb-1",
    name: "Reception Knowledge",
  },
  uploader: null,
};

function createRepositoryMock(): jest.Mocked<DocumentRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateAndReturn: jest.fn(),
    softDelete: jest.fn(),
    knowledgeBaseExists: jest.fn(),
    createAuditEvent: jest.fn(),
  } as unknown as jest.Mocked<DocumentRepository>;
}

function createStorageMock(): jest.Mocked<StorageService> {
  return {
    delete: jest.fn(),
    createDownloadUrl: jest.fn(),
  } as unknown as jest.Mocked<StorageService>;
}

describe("DocumentService", () => {
  it("creates document metadata only after validating tenant-owned knowledge base", async () => {
    const repository = createRepositoryMock();
    repository.knowledgeBaseExists.mockResolvedValue({ id: "kb-1" });
    repository.create.mockResolvedValue(document);
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new DocumentService(repository, createStorageMock());

    const result = await service.create(context, {
      knowledgeBaseId: "kb-1",
      name: " Pricing FAQ ",
      description: " Pricing answers ",
    });

    expect(repository.knowledgeBaseExists).toHaveBeenCalledWith("org-1", "kb-1");
    expect(repository.create).toHaveBeenCalledWith({
      organizationId: "org-1",
      knowledgeBaseId: "kb-1",
      name: "Pricing FAQ",
      description: "Pricing answers",
      uploadStatus: "PENDING",
      processingStatus: "PENDING",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "document.created",
        entityType: "Document",
        entityId: "doc-1",
      }),
    );
    expect(result.knowledgeBaseId).toBe("kb-1");
  });

  it("rejects document creation for a knowledge base outside tenant scope", async () => {
    const repository = createRepositoryMock();
    repository.knowledgeBaseExists.mockResolvedValue(null);
    const service = new DocumentService(repository, createStorageMock());

    await expect(
      service.create(context, {
        knowledgeBaseId: "other-kb",
        name: "Pricing FAQ",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists documents with tenant filters and parent validation", async () => {
    const repository = createRepositoryMock();
    repository.knowledgeBaseExists.mockResolvedValue({ id: "kb-1" });
    repository.list.mockResolvedValue({ total: 1, data: [document] });
    const service = new DocumentService(repository, createStorageMock());

    const result = await service.list(context, {
      page: 2,
      limit: 5,
      knowledgeBaseId: "kb-1",
      search: " pricing ",
      uploadStatus: UploadStatusDto.PENDING,
      processingStatus: ProcessingStatusDto.PENDING,
    });

    expect(repository.list).toHaveBeenCalledWith({
      organizationId: "org-1",
      page: 2,
      limit: 5,
      knowledgeBaseId: "kb-1",
      search: "pricing",
      uploadStatus: "PENDING",
      processingStatus: "PENDING",
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
  });

  it("throws not found for cross-tenant document access", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);
    const service = new DocumentService(repository, createStorageMock());

    await expect(service.getById(context, "other-doc")).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findById).toHaveBeenCalledWith("org-1", "other-doc");
  });

  it("updates document metadata and audits the change", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValueOnce(document).mockResolvedValueOnce({
      ...document,
      name: "Updated FAQ",
      uploadStatus: "UPLOADED",
      processingStatus: "COMPLETED",
    });
    repository.update.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new DocumentService(repository, createStorageMock());

    const result = await service.update(context, "doc-1", {
      name: " Updated FAQ ",
      uploadStatus: UploadStatusDto.UPLOADED,
      processingStatus: ProcessingStatusDto.COMPLETED,
    });

    expect(repository.update).toHaveBeenCalledWith("org-1", "doc-1", {
      name: "Updated FAQ",
      uploadStatus: "UPLOADED",
      processingStatus: "COMPLETED",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.updated", entityId: "doc-1" }),
    );
    expect(result.name).toBe("Updated FAQ");
  });

  it("soft deletes document metadata and audits it", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(document);
    repository.softDelete.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const storage = createStorageMock();
    const service = new DocumentService(repository, storage);

    await expect(service.delete(context, "doc-1")).resolves.toEqual({ success: true });

    expect(repository.softDelete).toHaveBeenCalledWith("org-1", "doc-1");
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.deleted", entityId: "doc-1" }),
    );
  });

  it("creates secure download access for uploaded PDFs and audits downloads", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue({
      ...document,
      fileName: "doc-1.pdf",
      originalFileName: "Pricing FAQ.pdf",
      fileType: "application/pdf",
      fileExtension: "pdf",
      fileSize: 1024,
      storagePath: "organizations/org-1/knowledge-bases/kb-1/documents/doc-1.pdf",
      storageProvider: "s3-compatible",
      storageBucket: "private-bucket",
      uploadStatus: "UPLOADED",
      uploadedBy: "user-1",
      uploader: {
        id: "user-1",
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
      },
    });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const storage = createStorageMock();
    storage.createDownloadUrl.mockResolvedValue({
      url: "https://storage.example.com/signed",
      expiresInSeconds: 300,
    });
    const service = new DocumentService(repository, storage);

    const result = await service.createDownloadAccess(context, "doc-1");

    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      "organizations/org-1/knowledge-bases/kb-1/documents/doc-1.pdf",
      "Pricing FAQ.pdf",
    );
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pdf.downloaded", entityId: "doc-1" }),
    );
    expect(result.url).toBe("https://storage.example.com/signed");
  });
});
