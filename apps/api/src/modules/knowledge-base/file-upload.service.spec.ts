import { BadRequestException } from "@nestjs/common";
import { FileUploadService, type UploadedPdf } from "./file-upload.service";
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
  description: "Reference PDF",
  fileName: "uuid.pdf",
  originalFileName: "Pricing FAQ.pdf",
  fileType: "application/pdf",
  fileExtension: "pdf",
  fileSize: 48,
  storagePath: null,
  storageProvider: null,
  storageBucket: null,
  uploadStatus: "PENDING" as const,
  processingStatus: "PENDING" as const,
  uploadedBy: "user-1",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  knowledgeBase: { id: "kb-1", name: "Reception Knowledge" },
  uploader: {
    id: "user-1",
    email: "owner@example.com",
    firstName: "Owner",
    lastName: "User",
  },
};

function createRepositoryMock(): jest.Mocked<DocumentRepository> {
  return {
    create: jest.fn(),
    update: jest.fn(),
    updateAndReturn: jest.fn(),
    knowledgeBaseExists: jest.fn(),
    createAuditEvent: jest.fn(),
  } as unknown as jest.Mocked<DocumentRepository>;
}

function createStorageMock(): jest.Mocked<StorageService> {
  return {
    upload: jest.fn(),
  } as unknown as jest.Mocked<StorageService>;
}

function pdfFile(overrides: Partial<UploadedPdf> = {}): UploadedPdf {
  const buffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

  return {
    originalname: "Pricing FAQ.pdf",
    mimetype: "application/pdf",
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

describe("FileUploadService", () => {
  it("uploads valid PDFs to storage and returns sanitized metadata", async () => {
    const repository = createRepositoryMock();
    const storage = createStorageMock();
    repository.knowledgeBaseExists.mockResolvedValue({ id: "kb-1" });
    repository.create.mockResolvedValue(document);
    repository.updateAndReturn.mockResolvedValue({
      ...document,
      storagePath: "organizations/org-1/knowledge-bases/kb-1/documents/doc-1.pdf",
      storageProvider: "s3-compatible",
      storageBucket: "private-bucket",
      uploadStatus: "UPLOADED",
    });
    repository.createAuditEvent.mockResolvedValue({} as never);
    storage.upload.mockResolvedValue({
      key: "organizations/org-1/knowledge-bases/kb-1/documents/doc-1.pdf",
      provider: "s3-compatible",
      bucket: "private-bucket",
    });
    const service = new FileUploadService(repository, storage);

    const result = await service.uploadPdf(
      context,
      { knowledgeBaseId: "kb-1", description: " Reference PDF " },
      pdfFile(),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        knowledgeBaseId: "kb-1",
        name: "Pricing FAQ",
        originalFileName: "Pricing FAQ.pdf",
        fileType: "application/pdf",
        fileExtension: "pdf",
        uploadedBy: "user-1",
      }),
    );
    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "organizations/org-1/knowledge-bases/kb-1/documents/doc-1.pdf",
        contentType: "application/pdf",
      }),
    );
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pdf.uploaded", entityId: "doc-1" }),
    );
    expect("storageBucket" in result).toBe(false);
    expect("storagePath" in result).toBe(false);
    expect(result.uploadStatus).toBe("UPLOADED");
  });

  it("rejects non-PDF files before creating metadata", async () => {
    const repository = createRepositoryMock();
    const storage = createStorageMock();
    repository.knowledgeBaseExists.mockResolvedValue({ id: "kb-1" });
    const service = new FileUploadService(repository, storage);

    await expect(
      service.uploadPdf(
        context,
        { knowledgeBaseId: "kb-1" },
        pdfFile({
          originalname: "notes.txt",
          mimetype: "text/plain",
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("marks upload failed and audits when storage upload fails", async () => {
    const repository = createRepositoryMock();
    const storage = createStorageMock();
    repository.knowledgeBaseExists.mockResolvedValue({ id: "kb-1" });
    repository.create.mockResolvedValue(document);
    repository.update.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    storage.upload.mockRejectedValue(new Error("storage unavailable"));
    const service = new FileUploadService(repository, storage);

    await expect(
      service.uploadPdf(context, { knowledgeBaseId: "kb-1" }, pdfFile()),
    ).rejects.toThrow("storage unavailable");

    expect(repository.update).toHaveBeenCalledWith("org-1", "doc-1", {
      uploadStatus: "FAILED",
      processingStatus: "FAILED",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pdf.upload_failed", entityId: "doc-1" }),
    );
  });
});
