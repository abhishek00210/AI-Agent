import { Injectable } from "@nestjs/common";
import type { AgentStatus, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface AgentListOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  status?: AgentStatus;
}

export interface AgentWriteInput {
  organizationId: string;
  name: string;
  description?: string | null;
  language: string;
  voice: string;
  systemPrompt: string;
  status: AgentStatus;
}

@Injectable()
export class AgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: AgentListOptions) {
    const where = this.buildScopedWhere(options);
    const skip = (options.page - 1) * options.limit;

    const [total, data] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: options.limit,
      }),
    ]);

    return { total, data };
  }

  findById(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: {
        id: agentId,
        organizationId,
        deletedAt: null,
      },
    });
  }

  create(input: AgentWriteInput) {
    return this.prisma.agent.create({
      data: input,
    });
  }

  update(
    organizationId: string,
    agentId: string,
    input: Partial<Omit<AgentWriteInput, "organizationId">>,
  ) {
    return this.prisma.agent.updateMany({
      where: {
        id: agentId,
        organizationId,
        deletedAt: null,
      },
      data: input,
    });
  }

  softDelete(organizationId: string, agentId: string) {
    return this.prisma.agent.updateMany({
      where: {
        id: agentId,
        organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
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

  private buildScopedWhere(options: AgentListOptions): Prisma.AgentWhereInput {
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
}
