import { Injectable } from "@nestjs/common";
import type { KnowledgeBaseStatus, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface KnowledgeBaseListOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: KnowledgeBaseStatus;
}

export interface KnowledgeBaseWriteInput {
  organizationId: string;
  agentId?: string | null;
  name: string;
  description?: string | null;
  status: KnowledgeBaseStatus;
}

@Injectable()
export class KnowledgeBaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: KnowledgeBaseListOptions) {
    const where = this.buildScopedWhere(options);
    const skip = (options.page - 1) * options.limit;

    const [total, data] = await Promise.all([
      this.prisma.knowledgeBase.count({ where }),
      this.prisma.knowledgeBase.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: options.limit,
      }),
    ]);

    return { total, data };
  }

  findById(organizationId: string, knowledgeBaseId: string) {
    return this.prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        organizationId,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });
  }

  create(input: KnowledgeBaseWriteInput) {
    return this.prisma.knowledgeBase.create({
      data: input,
      include: this.defaultInclude(),
    });
  }

  update(
    organizationId: string,
    knowledgeBaseId: string,
    input: Partial<Omit<KnowledgeBaseWriteInput, "organizationId">>,
  ) {
    return this.prisma.knowledgeBase.updateMany({
      where: {
        id: knowledgeBaseId,
        organizationId,
        deletedAt: null,
      },
      data: input,
    });
  }

  softDelete(organizationId: string, knowledgeBaseId: string) {
    return this.prisma.knowledgeBase.updateMany({
      where: {
        id: knowledgeBaseId,
        organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
      },
    });
  }

  agentExists(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: {
        id: agentId,
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

  private buildScopedWhere(options: KnowledgeBaseListOptions): Prisma.KnowledgeBaseWhereInput {
    return {
      organizationId: options.organizationId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { description: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private defaultInclude() {
    return {
      agent: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          documents: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    } satisfies Prisma.KnowledgeBaseInclude;
  }
}
