import { BadRequestException, NotFoundException } from "@nestjs/common";
import { WebsiteScraperService } from "./website-scraper.service";
import type { WebsiteExtractionService } from "./website-extraction.service";
import type { UrlSafetyService } from "./url-safety.service";
import { WebsiteSourceStatusDto } from "./dto/website-source.dto";
import type { WebsiteSourceRepository } from "./repositories/website-source.repository";
import type { TenantContext } from "../tenant/tenant.service";

const context: TenantContext = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER",
};

const now = new Date("2026-06-08T00:00:00.000Z");

const websiteSource = {
  id: "source-1",
  organizationId: "org-1",
  knowledgeBaseId: "kb-1",
  url: "https://example.com/docs",
  title: null,
  description: null,
  status: "PENDING" as const,
  contentLength: 0,
  lastScrapedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  knowledgeBase: { id: "kb-1", name: "Support Knowledge" },
  content: null,
};

function createRepositoryMock(): jest.Mocked<WebsiteSourceRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    findByIdForJob: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    saveExtractedContent: jest.fn(),
    softDelete: jest.fn(),
    knowledgeBaseExists: jest.fn(),
    createAuditEvent: jest.fn(),
  } as unknown as jest.Mocked<WebsiteSourceRepository>;
}

function createUrlSafetyMock(): jest.Mocked<UrlSafetyService> {
  return {
    validatePublicHttpUrl: jest.fn(async (url: string) => url.trim()),
  } as unknown as jest.Mocked<UrlSafetyService>;
}

function createExtractorMock(): jest.Mocked<WebsiteExtractionService> {
  return {
    extract: jest.fn(),
  } as unknown as jest.Mocked<WebsiteExtractionService>;
}

describe("WebsiteScraperService", () => {
  it("creates a pending website source scoped to the current organization", async () => {
    const repository = createRepositoryMock();
    const extractor = createExtractorMock();
    const urlSafety = createUrlSafetyMock();
    repository.knowledgeBaseExists.mockResolvedValue({ id: "kb-1" });
    repository.create.mockResolvedValue(websiteSource);
    repository.createAuditEvent.mockResolvedValue({} as never);
    const service = new WebsiteScraperService(repository, extractor, urlSafety);

    const result = await service.create(context, {
      knowledgeBaseId: "kb-1",
      url: " https://example.com/docs ",
    });

    expect(repository.knowledgeBaseExists).toHaveBeenCalledWith("org-1", "kb-1");
    expect(repository.create).toHaveBeenCalledWith({
      organizationId: "org-1",
      knowledgeBaseId: "kb-1",
      url: "https://example.com/docs",
      status: "PENDING",
    });
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "website.added",
        entityType: "WebsiteSource",
        entityId: "source-1",
      }),
    );
    expect(result.organizationId).toBe("org-1");
  });

  it("rejects creation when the knowledge base is outside the tenant", async () => {
    const repository = createRepositoryMock();
    repository.knowledgeBaseExists.mockResolvedValue(null);
    const service = new WebsiteScraperService(
      repository,
      createExtractorMock(),
      createUrlSafetyMock(),
    );

    await expect(
      service.create(context, { knowledgeBaseId: "other-kb", url: "https://example.com" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists website sources with tenant filters", async () => {
    const repository = createRepositoryMock();
    repository.list.mockResolvedValue({ total: 1, data: [websiteSource] });
    const service = new WebsiteScraperService(
      repository,
      createExtractorMock(),
      createUrlSafetyMock(),
    );

    const result = await service.list(context, {
      page: 2,
      limit: 5,
      search: " docs ",
      status: WebsiteSourceStatusDto.PENDING,
    });

    expect(repository.list).toHaveBeenCalledWith({
      organizationId: "org-1",
      page: 2,
      limit: 5,
      search: "docs",
      status: "PENDING",
    });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5 });
  });

  it("throws not found for cross-tenant source access", async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(null);
    const service = new WebsiteScraperService(
      repository,
      createExtractorMock(),
      createUrlSafetyMock(),
    );

    await expect(service.getById(context, "other-source")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findById).toHaveBeenCalledWith("org-1", "other-source");
  });

  it("processes a scrape job and stores extracted content", async () => {
    const repository = createRepositoryMock();
    const extractor = createExtractorMock();
    const extracted = {
      title: "Docs",
      description: "Helpful docs",
      content: "Helpful docs for voice agents and support workflows.",
      htmlContent: "<main>Helpful docs</main>",
      wordCount: 7,
    };
    repository.findByIdForJob.mockResolvedValue(websiteSource);
    repository.updateStatus.mockResolvedValue({ count: 1 });
    repository.saveExtractedContent.mockResolvedValue({
      ...websiteSource,
      title: "Docs",
      description: "Helpful docs",
      status: "COMPLETED",
      contentLength: extracted.content.length,
      lastScrapedAt: now,
      content: {
        id: "content-1",
        content: extracted.content,
        htmlContent: extracted.htmlContent,
        wordCount: extracted.wordCount,
        createdAt: now,
        updatedAt: now,
      },
    });
    repository.createAuditEvent.mockResolvedValue({} as never);
    extractor.extract.mockResolvedValue(extracted);
    const service = new WebsiteScraperService(repository, extractor, createUrlSafetyMock());

    const result = await service.processScrapeJob({
      websiteSourceId: "source-1",
      actorUserId: "user-1",
      attempt: 1,
      kind: "initial",
    });

    expect(repository.updateStatus).toHaveBeenCalledWith("org-1", "source-1", "SCRAPING");
    expect(extractor.extract).toHaveBeenCalledWith("https://example.com/docs");
    expect(repository.saveExtractedContent).toHaveBeenCalledWith("org-1", "source-1", extracted);
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "website.scraped", entityId: "source-1" }),
    );
    expect(result?.status).toBe("COMPLETED");
  });

  it("marks a scrape as failed and rethrows for queue retry", async () => {
    const repository = createRepositoryMock();
    const extractor = createExtractorMock();
    repository.findByIdForJob.mockResolvedValue(websiteSource);
    repository.updateStatus.mockResolvedValue({ count: 1 });
    repository.createAuditEvent.mockResolvedValue({} as never);
    extractor.extract.mockRejectedValue(new Error("Fetch failed"));
    const service = new WebsiteScraperService(repository, extractor, createUrlSafetyMock());

    await expect(
      service.processScrapeJob({
        websiteSourceId: "source-1",
        actorUserId: "user-1",
        attempt: 1,
        kind: "initial",
      }),
    ).rejects.toThrow("Fetch failed");

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "org-1",
      "source-1",
      "FAILED",
      expect.objectContaining({ lastScrapedAt: expect.any(Date) }),
    );
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "website.scrape_failed", entityId: "source-1" }),
    );
  });
});
