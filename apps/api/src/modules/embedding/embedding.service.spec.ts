import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ChunkingService } from "./chunking.service";
import { EmbeddingService } from "./embedding.service";
import type { PdfTextExtractionService } from "./pdf-text-extraction.service";
import type { OpenAIEmbeddingProvider } from "./providers/openai-embedding.provider";
import type { EmbeddingRepository } from "./repositories/embedding.repository";
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
  name: "Guide",
  description: null,
  fileName: "guide.pdf",
  originalFileName: "guide.pdf",
  fileType: "application/pdf",
  fileExtension: "pdf",
  fileSize: 1024,
  storagePath: "organizations/org-1/knowledge-bases/kb-1/documents/doc-1.pdf",
  storageProvider: "s3-compatible",
  storageBucket: "bucket",
  uploadStatus: "UPLOADED" as const,
  processingStatus: "PENDING" as const,
  uploadedBy: "user-1",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  knowledgeBase: { id: "kb-1", name: "Knowledge" },
};

const websiteSource = {
  id: "site-1",
  organizationId: "org-1",
  knowledgeBaseId: "kb-1",
  url: "https://example.com",
  title: "Example",
  description: null,
  status: "COMPLETED" as const,
  contentLength: 100,
  lastScrapedAt: now,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  knowledgeBase: { id: "kb-1", name: "Knowledge" },
  content: {
    content: "Helpful website content for support teams and AI voice agent answers.",
    wordCount: 10,
    updatedAt: now,
  },
};

function createRepositoryMock(): jest.Mocked<EmbeddingRepository> {
  return {
    findDocument: jest.fn(),
    findWebsiteSource: jest.fn(),
    knowledgeBaseExists: jest.fn(),
    updateDocumentProcessingStatus: jest.fn(),
    updateWebsiteSourceStatus: jest.fn(),
    replaceDocumentChunks: jest.fn(),
    replaceWebsiteChunks: jest.fn(),
    createEmbeddings: jest.fn(),
    listChunks: jest.fn(),
    sourceStats: jest.fn(),
    knowledgeBaseStats: jest.fn(),
    createAuditEvent: jest.fn(),
  } as unknown as jest.Mocked<EmbeddingRepository>;
}

function createStorageMock(): jest.Mocked<StorageService> {
  return {
    download: jest.fn(),
  } as unknown as jest.Mocked<StorageService>;
}

function createProviderMock(): jest.Mocked<OpenAIEmbeddingProvider> {
  return {
    generate: jest.fn(),
  } as unknown as jest.Mocked<OpenAIEmbeddingProvider>;
}

function createPdfExtractorMock(): jest.Mocked<PdfTextExtractionService> {
  return {
    extract: jest.fn(),
  } as unknown as jest.Mocked<PdfTextExtractionService>;
}

describe("EmbeddingService", () => {
  it("queues document processing only for uploaded tenant-owned PDFs", async () => {
    const repository = createRepositoryMock();
    repository.findDocument.mockResolvedValue(document);
    repository.updateDocumentProcessingStatus.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = createService(repository);

    const result = await service.prepareDocumentProcessing(context, "doc-1");

    expect(repository.updateDocumentProcessingStatus).toHaveBeenCalledWith(
      "org-1",
      "doc-1",
      "PROCESSING",
    );
    expect(result).toMatchObject({ sourceId: "doc-1", status: "PROCESSING", queued: true });
  });

  it("rejects cross-tenant document processing", async () => {
    const repository = createRepositoryMock();
    repository.findDocument.mockResolvedValue(null);
    const service = createService(repository);

    await expect(service.prepareDocumentProcessing(context, "other-doc")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("processes PDF text into chunks and embeddings", async () => {
    const repository = createRepositoryMock();
    const storage = createStorageMock();
    const provider = createProviderMock();
    const pdfExtractor = createPdfExtractorMock();
    repository.findDocument.mockResolvedValue(document);
    repository.updateDocumentProcessingStatus.mockResolvedValue({ count: 1 });
    repository.replaceDocumentChunks.mockResolvedValue([
      {
        id: "chunk-0",
        organizationId: "org-1",
        knowledgeBaseId: "kb-1",
        documentId: "doc-1",
        websiteSourceId: null,
        faqEntryId: null,
        chunkIndex: 0,
        chunkText: "Useful PDF content for support teams and customer questions.",
        tokenCount: 9,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);
    repository.createEmbeddings.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    storage.download.mockResolvedValue({ body: Buffer.from("%PDF-test") });
    pdfExtractor.extract.mockResolvedValue(
      "Useful PDF content for support teams and customer questions.",
    );
    provider.generate.mockResolvedValue({
      model: "text-embedding-3-small",
      dimensions: 3,
      vectors: [[0.1, 0.2, 0.3]],
    });
    const service = createService(repository, storage, provider, pdfExtractor);

    await service.processDocumentJob({
      organizationId: "org-1",
      actorUserId: "user-1",
      documentId: "doc-1",
    });

    expect(storage.download).toHaveBeenCalledWith(document.storagePath);
    expect(repository.replaceDocumentChunks).toHaveBeenCalled();
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ texts: expect.arrayContaining([expect.any(String)]) }),
    );
    expect(repository.createEmbeddings).toHaveBeenCalledWith([
      expect.objectContaining({ chunkId: "chunk-0", dimensions: 3 }),
    ]);
    expect(repository.updateDocumentProcessingStatus).toHaveBeenLastCalledWith(
      "org-1",
      "doc-1",
      "COMPLETED",
    );
  });

  it("processes website content into chunks and embeddings", async () => {
    const repository = createRepositoryMock();
    const provider = createProviderMock();
    repository.findWebsiteSource.mockResolvedValue(websiteSource);
    repository.updateWebsiteSourceStatus.mockResolvedValue({ count: 1 });
    repository.replaceWebsiteChunks.mockResolvedValue([
      {
        id: "chunk-0",
        organizationId: "org-1",
        knowledgeBaseId: "kb-1",
        documentId: null,
        websiteSourceId: "site-1",
        faqEntryId: null,
        chunkIndex: 0,
        chunkText: "Helpful website content for support teams and AI voice agent answers.",
        tokenCount: 10,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);
    repository.createEmbeddings.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    provider.generate.mockResolvedValue({
      model: "text-embedding-3-small",
      dimensions: 3,
      vectors: [[0.1, 0.2, 0.3]],
    });
    const service = createService(repository, undefined, provider);

    await service.processWebsiteJob({
      organizationId: "org-1",
      actorUserId: "user-1",
      websiteSourceId: "site-1",
    });

    expect(repository.replaceWebsiteChunks).toHaveBeenCalled();
    expect(repository.createEmbeddings).toHaveBeenCalled();
    expect(repository.updateWebsiteSourceStatus).toHaveBeenLastCalledWith(
      "org-1",
      "site-1",
      "COMPLETED",
    );
  });

  it("marks document processing as failed when embedding generation fails", async () => {
    const repository = createRepositoryMock();
    const storage = createStorageMock();
    const provider = createProviderMock();
    const pdfExtractor = createPdfExtractorMock();
    repository.findDocument.mockResolvedValue(document);
    repository.updateDocumentProcessingStatus.mockResolvedValue({ count: 1 });
    repository.replaceDocumentChunks.mockResolvedValue([
      {
        id: "chunk-1",
        organizationId: "org-1",
        knowledgeBaseId: "kb-1",
        documentId: "doc-1",
        websiteSourceId: null,
        faqEntryId: null,
        chunkIndex: 0,
        chunkText: "Chunk text",
        tokenCount: 3,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);
    repository.createAuditEvent.mockResolvedValue({} as never);
    storage.download.mockResolvedValue({ body: Buffer.from("%PDF-test") });
    pdfExtractor.extract.mockResolvedValue("Useful PDF content for support teams.");
    provider.generate.mockRejectedValue(new BadRequestException("Embedding failed"));
    const service = createService(repository, storage, provider, pdfExtractor);

    await expect(
      service.processDocumentJob({
        organizationId: "org-1",
        actorUserId: "user-1",
        documentId: "doc-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.updateDocumentProcessingStatus).toHaveBeenLastCalledWith(
      "org-1",
      "doc-1",
      "FAILED",
    );
  });
});

function createService(
  repository = createRepositoryMock(),
  storage = createStorageMock(),
  provider = createProviderMock(),
  pdfExtractor = createPdfExtractorMock(),
) {
  return new EmbeddingService(repository, storage, new ChunkingService(), provider, pdfExtractor);
}
