import { Injectable } from "@nestjs/common";
import type { MemoryFactType, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class MemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConversation(organizationId: string, conversationId: string) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId, deletedAt: null },
      select: { id: true, organizationId: true, agentId: true },
    });
  }

  latestMemory(organizationId: string, conversationId: string) {
    return this.prisma.conversationMemory.findFirst({
      where: { organizationId, conversationId },
      orderBy: { generatedAt: "desc" },
    });
  }

  memoryHistory(organizationId: string, conversationId: string) {
    return this.prisma.conversationMemory.findMany({
      where: { organizationId, conversationId },
      orderBy: { generatedAt: "desc" },
      take: 10,
    });
  }

  listFacts(organizationId: string, conversationId: string) {
    return this.prisma.memoryFact.findMany({
      where: { organizationId, conversationId },
      orderBy: [{ factType: "asc" }, { factKey: "asc" }],
    });
  }

  countMessages(organizationId: string, conversationId: string) {
    return this.prisma.message.count({
      where: {
        organizationId,
        conversationId,
        deletedAt: null,
        conversation: { deletedAt: null },
      },
    });
  }

  tokenEstimate(organizationId: string, conversationId: string) {
    return this.prisma.message.aggregate({
      where: {
        organizationId,
        conversationId,
        deletedAt: null,
        conversation: { deletedAt: null },
      },
      _sum: { tokenCount: true },
    });
  }

  loadMessages(organizationId: string, conversationId: string) {
    return this.prisma.message.findMany({
      where: {
        organizationId,
        conversationId,
        deletedAt: null,
        conversation: { deletedAt: null },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        senderType: true,
        content: true,
        tokenCount: true,
        createdAt: true,
      },
    });
  }

  async createMemory(input: {
    organizationId: string;
    conversationId: string;
    summary: string;
    messageCount: number;
    tokenEstimate: number;
  }) {
    return this.prisma.conversationMemory.create({
      data: {
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        summary: input.summary,
        messageCount: input.messageCount,
        tokenEstimate: input.tokenEstimate,
      },
    });
  }

  async replaceFacts(
    organizationId: string,
    conversationId: string,
    facts: Array<{
      factType: MemoryFactType;
      factKey: string;
      factValue: string;
      confidence: number;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.memoryFact.deleteMany({ where: { organizationId, conversationId } });
      if (facts.length === 0) {
        return [];
      }
      await tx.memoryFact.createMany({
        data: facts.map((fact) => ({
          organizationId,
          conversationId,
          factType: fact.factType,
          factKey: fact.factKey,
          factValue: fact.factValue,
          confidence: fact.confidence,
        })),
      });
      return tx.memoryFact.findMany({
        where: { organizationId, conversationId },
        orderBy: [{ factType: "asc" }, { factKey: "asc" }],
      });
    });
  }

  deleteFact(organizationId: string, factId: string) {
    return this.prisma.memoryFact.deleteMany({
      where: { id: factId, organizationId },
    });
  }

  countMemoryUpdates(organizationId: string, conversationId: string) {
    return this.prisma.conversationMemory.count({
      where: { organizationId, conversationId },
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
}
