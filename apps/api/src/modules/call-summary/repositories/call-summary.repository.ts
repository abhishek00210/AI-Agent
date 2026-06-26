import { Injectable } from "@nestjs/common";
import type { Outcome, Prisma, Sentiment } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface CallSummaryListOptions {
  organizationId: string;
  page: number;
  limit: number;
  search?: string;
  sentiment?: Sentiment;
  outcome?: Outcome;
}

export interface UpsertCallSummaryInput {
  organizationId: string;
  customerProfileId: string;
  callId: string;
  conversationId?: string | null;
  transcriptId?: string | null;
  summary: string;
  intent: string;
  sentiment: Sentiment;
  outcome: Outcome;
  nextAction?: string | null;
  followUpRequired: boolean;
  confidenceScore: number;
  summaryVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  generatedAt: Date;
}

@Injectable()
export class CallSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  transcriptContext(organizationId: string, transcriptId: string) {
    return this.prisma.callTranscript.findFirst({
      where: { id: transcriptId, organizationId, status: "COMPLETED" },
      select: {
        id: true,
        organizationId: true,
        callId: true,
        conversationId: true,
        fullText: true,
        summary: true,
        completedAt: true,
        call: {
          select: {
            id: true,
            callerNumber: true,
            calledNumber: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationSeconds: true,
            agent: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  upsert(input: UpsertCallSummaryInput) {
    return this.prisma.callSummary.upsert({
      where: { callId: input.callId },
      create: input,
      update: {
        customerProfileId: input.customerProfileId,
        conversationId: input.conversationId,
        transcriptId: input.transcriptId,
        summary: input.summary,
        intent: input.intent,
        sentiment: input.sentiment,
        outcome: input.outcome,
        nextAction: input.nextAction,
        followUpRequired: input.followUpRequired,
        confidenceScore: input.confidenceScore,
        summaryVersion: input.summaryVersion,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens: input.totalTokens,
        estimatedCostMicros: input.estimatedCostMicros,
        generatedAt: input.generatedAt,
      },
      include: this.defaultInclude(),
    });
  }

  findById(organizationId: string, id: string) {
    return this.prisma.callSummary.findFirst({
      where: { id, organizationId },
      include: this.defaultInclude(),
    });
  }

  findByCallId(organizationId: string, callId: string) {
    return this.prisma.callSummary.findFirst({
      where: { callId, organizationId },
      include: this.defaultInclude(),
    });
  }

  linkOutboundSummary(input: {
    organizationId: string;
    callId: string;
    summaryId: string;
    qualified: boolean;
    appointmentBooked: boolean;
  }) {
    return this.prisma.outboundCall.updateMany({
      where: { organizationId: input.organizationId, callId: input.callId },
      data: {
        summaryId: input.summaryId,
        ...(input.qualified ? { qualified: true } : {}),
        ...(input.appointmentBooked ? { appointmentBooked: true } : {}),
      },
    });
  }

  async findByCustomer(organizationId: string, customerProfileId: string, limit = 25) {
    return this.prisma.callSummary.findMany({
      where: { organizationId, customerProfileId },
      include: this.defaultInclude(),
      orderBy: { generatedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async list(options: CallSummaryListOptions) {
    const where: Prisma.CallSummaryWhereInput = {
      organizationId: options.organizationId,
      ...(options.sentiment ? { sentiment: options.sentiment } : {}),
      ...(options.outcome ? { outcome: options.outcome } : {}),
      ...(options.search
        ? {
            OR: [
              { summary: { contains: options.search, mode: "insensitive" } },
              { intent: { contains: options.search, mode: "insensitive" } },
              { nextAction: { contains: options.search, mode: "insensitive" } },
              { call: { callerNumber: { contains: options.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.callSummary.count({ where }),
      this.prisma.callSummary.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { generatedAt: "desc" },
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
    ]);
  }

  createAuditEvent(input: {
    organizationId: string;
    action: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({
      data: { ...input, entityType: "CallSummary" },
    });
  }

  private defaultInclude() {
    return {
      customerProfile: { select: { id: true, name: true, phone: true, email: true } },
      call: {
        select: {
          id: true,
          callerNumber: true,
          calledNumber: true,
          startedAt: true,
          agent: { select: { id: true, name: true } },
        },
      },
    } satisfies Prisma.CallSummaryInclude;
  }
}
