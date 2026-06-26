import { Injectable } from "@nestjs/common";
import type { Prisma, WebsiteSourceStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface WebsiteSourceListOptions {
  organizationId: string;
  page: number;
  limit: number;
  knowledgeBaseId?: string;
  search?: string;
  status?: WebsiteSourceStatus;
}

export interface WebsiteSourceWriteInput {
  organizationId: string;
  knowledgeBaseId: string;
  url: string;
  status: WebsiteSourceStatus;
}

export interface ExtractedWebsiteContent {
  title: string | null;
  description: string | null;
  content: string;
  htmlContent: string;
  wordCount: number;
}

@Injectable()
export class WebsiteSourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: WebsiteSourceListOptions) {
    const where = this.buildScopedWhere(options);
    const skip = (options.page - 1) * options.limit;

    const [total, data] = await Promise.all([
      this.prisma.websiteSource.count({ where }),
      this.prisma.websiteSource.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: options.limit,
      }),
    ]);

    return { total, data };
  }

  findById(organizationId: string, websiteSourceId: string) {
    return this.prisma.websiteSource.findFirst({
      where: {
        id: websiteSourceId,
        organizationId,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });
  }

  findByIdForJob(websiteSourceId: string) {
    return this.prisma.websiteSource.findFirst({
      where: {
        id: websiteSourceId,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });
  }

  create(input: WebsiteSourceWriteInput) {
    return this.prisma.websiteSource.create({
      data: input,
      include: this.defaultInclude(),
    });
  }

  updateStatus(
    organizationId: string,
    websiteSourceId: string,
    status: WebsiteSourceStatus,
    extra: Prisma.WebsiteSourceUpdateManyMutationInput = {},
  ) {
    return this.prisma.websiteSource.updateMany({
      where: {
        id: websiteSourceId,
        organizationId,
        deletedAt: null,
      },
      data: {
        status,
        ...extra,
      },
    });
  }

  async saveExtractedContent(
    organizationId: string,
    websiteSourceId: string,
    extracted: ExtractedWebsiteContent,
  ) {
    await this.prisma.websiteSource.updateMany({
      where: {
        id: websiteSourceId,
        organizationId,
        deletedAt: null,
      },
      data: {
        title: extracted.title,
        description: extracted.description,
        status: "COMPLETED",
        contentLength: extracted.content.length,
        lastScrapedAt: new Date(),
      },
    });

    await this.prisma.websiteContent.upsert({
      where: {
        websiteSourceId,
      },
      create: {
        websiteSourceId,
        organizationId,
        content: extracted.content,
        htmlContent: extracted.htmlContent,
        wordCount: extracted.wordCount,
      },
      update: {
        content: extracted.content,
        htmlContent: extracted.htmlContent,
        wordCount: extracted.wordCount,
      },
    });

    return this.findById(organizationId, websiteSourceId);
  }

  softDelete(organizationId: string, websiteSourceId: string) {
    return this.prisma.websiteSource.updateMany({
      where: {
        id: websiteSourceId,
        organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
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
      select: {
        id: true,
      },
    });
  }

  createAuditEvent(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({
      data: input,
    });
  }

  private buildScopedWhere(options: WebsiteSourceListOptions): Prisma.WebsiteSourceWhereInput {
    return {
      organizationId: options.organizationId,
      deletedAt: null,
      ...(options.knowledgeBaseId ? { knowledgeBaseId: options.knowledgeBaseId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.search
        ? {
            OR: [
              { url: { contains: options.search, mode: "insensitive" } },
              { title: { contains: options.search, mode: "insensitive" } },
              { description: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private defaultInclude() {
    return {
      knowledgeBase: {
        select: {
          id: true,
          name: true,
        },
      },
      content: {
        select: {
          id: true,
          content: true,
          htmlContent: true,
          wordCount: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    } satisfies Prisma.WebsiteSourceInclude;
  }
}
