import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, WebsiteSourceStatus } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { CreateWebsiteSourceDto, ListWebsiteSourcesQueryDto } from "./dto/website-source.dto";
import { UrlSafetyService } from "./url-safety.service";
import type { WebsiteScrapingJob } from "./website-scraper.queue";
import { WebsiteExtractionService } from "./website-extraction.service";
import { WebsiteSourceRepository } from "./repositories/website-source.repository";

@Injectable()
export class WebsiteScraperService {
  constructor(
    private readonly websiteSources: WebsiteSourceRepository,
    private readonly extractor: WebsiteExtractionService,
    private readonly urlSafety: UrlSafetyService,
  ) {}

  async create(context: TenantContext, input: CreateWebsiteSourceDto) {
    await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, input.knowledgeBaseId);
    const url = await this.urlSafety.validatePublicHttpUrl(input.url);

    const websiteSource = await this.websiteSources.create({
      organizationId: context.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      url,
      status: "PENDING",
    });

    await this.audit(context, "website.added", websiteSource.id, {
      url,
      knowledgeBaseId: input.knowledgeBaseId,
    });

    return this.toResponse(websiteSource);
  }

  async list(context: TenantContext, query: ListWebsiteSourcesQueryDto) {
    if (query.knowledgeBaseId) {
      await this.assertKnowledgeBaseBelongsToTenant(context.organizationId, query.knowledgeBaseId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const result = await this.websiteSources.list({
      organizationId: context.organizationId,
      page,
      limit,
      knowledgeBaseId: query.knowledgeBaseId,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as WebsiteSourceStatus | undefined,
    });

    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((source) => this.toResponse(source)),
    };
  }

  async getById(context: TenantContext, websiteSourceId: string) {
    const source = await this.getScopedSource(context.organizationId, websiteSourceId);
    return this.toResponse(source);
  }

  async prepareRescrape(context: TenantContext, websiteSourceId: string) {
    const source = await this.getScopedSource(context.organizationId, websiteSourceId);
    await this.websiteSources.updateStatus(context.organizationId, websiteSourceId, "PENDING");
    await this.audit(context, "website.rescrape_requested", source.id, { url: source.url });
    const updated = await this.getScopedSource(context.organizationId, websiteSourceId);
    return this.toResponse(updated);
  }

  async delete(context: TenantContext, websiteSourceId: string) {
    const source = await this.getScopedSource(context.organizationId, websiteSourceId);
    await this.websiteSources.softDelete(context.organizationId, websiteSourceId);
    await this.audit(context, "website.deleted", source.id, { url: source.url });
    return { success: true };
  }

  async processScrapeJob(job: WebsiteScrapingJob) {
    const source = await this.websiteSources.findByIdForJob(job.websiteSourceId);
    if (!source) {
      return;
    }

    await this.websiteSources.updateStatus(source.organizationId, source.id, "SCRAPING");

    try {
      const extracted = await this.extractor.extract(source.url);
      const saved = await this.websiteSources.saveExtractedContent(
        source.organizationId,
        source.id,
        extracted,
      );

      await this.websiteSources.createAuditEvent({
        organizationId: source.organizationId,
        actorUserId: job.actorUserId,
        action: job.kind === "rescrape" ? "website.rescraped" : "website.scraped",
        entityType: "WebsiteSource",
        entityId: source.id,
        metadata: {
          url: source.url,
          wordCount: extracted.wordCount,
          contentLength: extracted.content.length,
        },
      });

      return saved ? this.toResponse(saved) : undefined;
    } catch (error) {
      await this.websiteSources.updateStatus(source.organizationId, source.id, "FAILED", {
        lastScrapedAt: new Date(),
      });
      await this.websiteSources.createAuditEvent({
        organizationId: source.organizationId,
        actorUserId: job.actorUserId,
        action: "website.scrape_failed",
        entityType: "WebsiteSource",
        entityId: source.id,
        metadata: {
          url: source.url,
          attempt: job.attempt,
          reason: error instanceof Error ? error.message : "Unknown scrape error",
        },
      });
      throw error;
    }
  }

  async markJobFailed(websiteSourceId: string, actorUserId?: string) {
    const source = await this.websiteSources.findByIdForJob(websiteSourceId);
    if (!source) {
      return;
    }

    await this.websiteSources.updateStatus(source.organizationId, source.id, "FAILED", {
      lastScrapedAt: new Date(),
    });
    await this.websiteSources.createAuditEvent({
      organizationId: source.organizationId,
      actorUserId,
      action: "website.scrape_failed",
      entityType: "WebsiteSource",
      entityId: source.id,
      metadata: {
        url: source.url,
        reason: "Maximum retry attempts reached.",
      },
    });
  }

  private async getScopedSource(organizationId: string, websiteSourceId: string) {
    const source = await this.websiteSources.findById(organizationId, websiteSourceId);
    if (!source) {
      throw new NotFoundException("Website source not found.");
    }

    return source;
  }

  private async assertKnowledgeBaseBelongsToTenant(
    organizationId: string,
    knowledgeBaseId: string,
  ) {
    const knowledgeBase = await this.websiteSources.knowledgeBaseExists(
      organizationId,
      knowledgeBaseId,
    );

    if (!knowledgeBase) {
      throw new BadRequestException("Knowledge base is not available in this organization.");
    }
  }

  private toResponse(source: {
    id: string;
    organizationId: string;
    knowledgeBaseId: string;
    url: string;
    title: string | null;
    description: string | null;
    status: WebsiteSourceStatus;
    contentLength: number;
    lastScrapedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    knowledgeBase: { id: string; name: string };
    content?: {
      id: string;
      content: string;
      htmlContent: string;
      wordCount: number;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }) {
    return {
      id: source.id,
      organizationId: source.organizationId,
      knowledgeBaseId: source.knowledgeBaseId,
      knowledgeBase: source.knowledgeBase,
      url: source.url,
      title: source.title,
      description: source.description,
      status: source.status,
      contentLength: source.contentLength,
      lastScrapedAt: source.lastScrapedAt,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      content: source.content ?? null,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.websiteSources.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "WebsiteSource",
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
