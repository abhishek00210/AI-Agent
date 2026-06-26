import { Injectable, NotFoundException } from "@nestjs/common";
import type { FaqStatus, Prisma } from "../../../generated/prisma";
import { estimateTokenCount } from "../embedding/chunking.service";
import { OpenAIEmbeddingProvider } from "../embedding/providers/openai-embedding.provider";
import type { TenantContext } from "../tenant/tenant.service";
import type { CreateFaqDto, ListFaqsQueryDto, UpdateFaqDto } from "./dto/faq.dto";
import { FaqRepository } from "./repositories/faq.repository";

@Injectable()
export class FaqService {
  constructor(
    private readonly faqs: FaqRepository,
    private readonly embeddings: OpenAIEmbeddingProvider,
  ) {}

  async create(context: TenantContext, input: CreateFaqDto) {
    await this.assertKnowledgeBase(context.organizationId, input.knowledgeBaseId);
    const faq = await this.faqs.create({
      organizationId: context.organizationId,
      knowledgeBaseId: input.knowledgeBaseId,
      question: input.question.trim(),
      answer: input.answer.trim(),
      status: (input.status ?? "ACTIVE") as FaqStatus,
    });
    await this.embedFaq(context, faq);
    await this.audit(context, "faq.created", faq.id, { knowledgeBaseId: faq.knowledgeBaseId });
    return this.toResponse(faq);
  }

  async list(context: TenantContext, query: ListFaqsQueryDto) {
    if (query.knowledgeBaseId) {
      await this.assertKnowledgeBase(context.organizationId, query.knowledgeBaseId);
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const result = await this.faqs.list({
      organizationId: context.organizationId,
      page,
      limit,
      knowledgeBaseId: query.knowledgeBaseId,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as FaqStatus | undefined,
    });
    return {
      total: result.total,
      page,
      limit,
      data: result.data.map((faq) => this.toResponse(faq)),
    };
  }

  async getById(context: TenantContext, faqId: string) {
    return this.toResponse(await this.getScopedFaq(context.organizationId, faqId));
  }

  async update(context: TenantContext, faqId: string, input: UpdateFaqDto) {
    const existing = await this.getScopedFaq(context.organizationId, faqId);
    const faq = await this.faqs.updateAndReturn(context.organizationId, faqId, {
      ...(input.question !== undefined ? { question: input.question.trim() } : {}),
      ...(input.answer !== undefined ? { answer: input.answer.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status as FaqStatus } : {}),
    });
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }
    if (input.question !== undefined || input.answer !== undefined || input.status === "ACTIVE") {
      await this.embedFaq(context, faq);
    }
    await this.audit(context, "faq.updated", faq.id, {
      before: { question: existing.question, status: existing.status },
      after: { question: faq.question, status: faq.status },
    });
    return this.toResponse(faq);
  }

  async delete(context: TenantContext, faqId: string) {
    const faq = await this.getScopedFaq(context.organizationId, faqId);
    await this.faqs.softDelete(context.organizationId, faqId);
    await this.audit(context, "faq.deleted", faq.id, { knowledgeBaseId: faq.knowledgeBaseId });
    return { success: true };
  }

  private async embedFaq(
    context: TenantContext,
    faq: {
      id: string;
      organizationId: string;
      knowledgeBaseId: string;
      question: string;
      answer: string;
      status: FaqStatus;
    },
  ) {
    if (faq.status !== "ACTIVE") {
      return;
    }
    const chunkText = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
    const result = await this.embeddings.generate({ texts: [chunkText], user: context.userId });
    await this.faqs.replaceFaqEmbedding({
      organizationId: faq.organizationId,
      knowledgeBaseId: faq.knowledgeBaseId,
      faqEntryId: faq.id,
      chunkText,
      tokenCount: estimateTokenCount(chunkText),
      embeddingModel: result.model,
      dimensions: result.dimensions,
      embeddingVector: result.vectors[0] ?? [],
    });
  }

  private async getScopedFaq(organizationId: string, faqId: string) {
    const faq = await this.faqs.findById(organizationId, faqId);
    if (!faq) {
      throw new NotFoundException("FAQ not found.");
    }
    return faq;
  }

  private async assertKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    const knowledgeBase = await this.faqs.knowledgeBaseExists(organizationId, knowledgeBaseId);
    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }
  }

  private toResponse(faq: {
    id: string;
    organizationId: string;
    knowledgeBaseId: string;
    question: string;
    answer: string;
    status: FaqStatus;
    createdAt: Date;
    updatedAt: Date;
    knowledgeBase?: { id: string; name: string };
  }) {
    return {
      id: faq.id,
      organizationId: faq.organizationId,
      knowledgeBaseId: faq.knowledgeBaseId,
      knowledgeBase: faq.knowledgeBase,
      question: faq.question,
      answer: faq.answer,
      status: faq.status,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
    };
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.faqs.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType: "FaqEntry",
      entityId,
      metadata,
    });
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
