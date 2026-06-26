import { Injectable } from "@nestjs/common";
import type { FaqStatus, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface FaqListOptions {
  organizationId: string;
  page: number;
  limit: number;
  knowledgeBaseId?: string;
  search?: string;
  status?: FaqStatus;
}

export interface FaqWriteInput {
  organizationId: string;
  knowledgeBaseId: string;
  question: string;
  answer: string;
  status: FaqStatus;
}

@Injectable()
export class FaqRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: FaqListOptions) {
    const where = this.buildScopedWhere(options);
    const skip = (options.page - 1) * options.limit;
    const [total, data] = await Promise.all([
      this.prisma.faqEntry.count({ where }),
      this.prisma.faqEntry.findMany({
        where,
        include: { knowledgeBase: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: options.limit,
      }),
    ]);
    return { total, data };
  }

  findById(organizationId: string, faqId: string) {
    return this.prisma.faqEntry.findFirst({
      where: { id: faqId, organizationId, deletedAt: null },
      include: { knowledgeBase: { select: { id: true, name: true } } },
    });
  }

  knowledgeBaseExists(organizationId: string, knowledgeBaseId: string) {
    return this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId, deletedAt: null },
      select: { id: true },
    });
  }

  create(input: FaqWriteInput) {
    return this.prisma.faqEntry.create({
      data: input,
      include: { knowledgeBase: { select: { id: true, name: true } } },
    });
  }

  async updateAndReturn(
    organizationId: string,
    faqId: string,
    input: Partial<Omit<FaqWriteInput, "organizationId" | "knowledgeBaseId">>,
  ) {
    await this.prisma.faqEntry.updateMany({
      where: { id: faqId, organizationId, deletedAt: null },
      data: input,
    });
    return this.findById(organizationId, faqId);
  }

  softDelete(organizationId: string, faqId: string) {
    return this.prisma.faqEntry.updateMany({
      where: { id: faqId, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  }

  async replaceFaqEmbedding(input: {
    organizationId: string;
    knowledgeBaseId: string;
    faqEntryId: string;
    chunkText: string;
    tokenCount: number;
    embeddingModel: string;
    dimensions: number;
    embeddingVector: number[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: { organizationId: input.organizationId, faqEntryId: input.faqEntryId },
      });
      const chunk = await tx.knowledgeChunk.create({
        data: {
          organizationId: input.organizationId,
          knowledgeBaseId: input.knowledgeBaseId,
          faqEntryId: input.faqEntryId,
          chunkIndex: 0,
          chunkText: input.chunkText,
          tokenCount: input.tokenCount,
          metadata: {
            sourceType: "faq",
            faqEntryId: input.faqEntryId,
            knowledgeBaseId: input.knowledgeBaseId,
            chunkNumber: 1,
          },
        },
      });
      await tx.knowledgeEmbedding.create({
        data: {
          organizationId: input.organizationId,
          chunkId: chunk.id,
          embeddingModel: input.embeddingModel,
          dimensions: input.dimensions,
          embeddingVector: input.embeddingVector,
        },
      });
      return chunk;
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
    return this.prisma.auditEvent.create({ data: input });
  }

  private buildScopedWhere(options: FaqListOptions): Prisma.FaqEntryWhereInput {
    return {
      organizationId: options.organizationId,
      deletedAt: null,
      ...(options.knowledgeBaseId ? { knowledgeBaseId: options.knowledgeBaseId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.search
        ? {
            OR: [
              { question: { contains: options.search, mode: "insensitive" } },
              { answer: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
}
