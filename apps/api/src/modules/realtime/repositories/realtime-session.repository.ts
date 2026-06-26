import { Injectable } from "@nestjs/common";
import type { Prisma, RealtimeSessionStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class RealtimeSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCallSessionId(callSessionId: string) {
    return this.prisma.realtimeSession.findUnique({
      where: { callSessionId },
    });
  }

  findById(realtimeSessionId: string) {
    return this.prisma.realtimeSession.findUnique({
      where: { id: realtimeSessionId },
    });
  }

  findCallSessionByStreamSid(streamSid: string) {
    return this.prisma.callSession.findFirst({
      where: {
        streamSid,
        status: "CONNECTED",
      },
      select: {
        id: true,
        callId: true,
        organizationId: true,
        call: {
          select: {
            organizationId: true,
            callerNumber: true,
            direction: true,
            metadata: true,
            agent: {
              select: {
                id: true,
                name: true,
                systemPrompt: true,
                language: true,
                voice: true,
                updatedAt: true,
                status: true,
                deletedAt: true,
                knowledgeBases: {
                  where: { deletedAt: null, status: "ACTIVE" },
                  select: { id: true, updatedAt: true },
                },
              },
            },
          },
        },
      },
    });
  }

  recentCustomerSummaries(
    organizationId: string,
    callerNumber: string,
    excludeCallId: string,
  ) {
    return this.prisma.callSummary.findMany({
      where: {
        organizationId,
        callId: { not: excludeCallId },
        customerProfile: { phone: callerNumber },
      },
      select: {
        summary: true,
        intent: true,
        outcome: true,
        nextAction: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: "desc" },
      take: 3,
    });
  }

  upsertConnecting(input: {
    organizationId: string;
    callId: string;
    callSessionId: string;
    agentId: string;
    conversationId: string;
  }) {
    return this.prisma.realtimeSession
      .upsert({
        where: { callSessionId: input.callSessionId },
        create: {
          ...input,
          status: "CONNECTING",
        },
        update: {
          status: "CONNECTING",
          disconnectedAt: null,
        },
      })
      .then(async (session) => {
        await this.prisma.call.updateMany({
          where: {
            id: input.callId,
            organizationId: input.organizationId,
            conversationId: null,
          },
          data: { conversationId: input.conversationId },
        });
        return session;
      });
  }

  markConnected(realtimeSessionId: string, openAiSessionId?: string) {
    return this.prisma.realtimeSession.update({
      where: { id: realtimeSessionId },
      data: {
        openAiSessionId,
        status: "CONNECTED",
        connectedAt: new Date(),
        disconnectedAt: null,
      },
    });
  }

  async markClosedIfActive(
    realtimeSessionId: string,
    status: RealtimeSessionStatus,
    audioPacketsSent = 0,
    audioPacketsReceived = 0,
  ) {
    const result = await this.prisma.realtimeSession.updateMany({
      where: {
        id: realtimeSessionId,
        status: { in: ["CONNECTING", "CONNECTED"] },
      },
      data: {
        status,
        disconnectedAt: new Date(),
        audioPacketsSent: { increment: audioPacketsSent },
        audioPacketsReceived: { increment: audioPacketsReceived },
      },
    });
    const session = await this.findById(realtimeSessionId);
    return { session, changed: result.count > 0 };
  }

  recordLatency(realtimeSessionId: string, latencyMs: number) {
    return this.prisma.realtimeSession.update({
      where: { id: realtimeSessionId },
      data: { lastLatencyMs: latencyMs },
    });
  }

  findByCallId(organizationId: string, callId: string) {
    return this.prisma.realtimeSession.findMany({
      where: { organizationId, callId },
      include: {
        agent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async stats(organizationId: string) {
    const where: Prisma.RealtimeSessionWhereInput = { organizationId };
    const [total, active, failed, connected, packetAggregate] = await Promise.all([
      this.prisma.realtimeSession.count({ where }),
      this.prisma.realtimeSession.count({ where: { ...where, status: "CONNECTED" } }),
      this.prisma.realtimeSession.count({ where: { ...where, status: "FAILED" } }),
      this.prisma.realtimeSession.count({
        where: { ...where, status: { in: ["CONNECTED", "DISCONNECTED"] } },
      }),
      this.prisma.realtimeSession.aggregate({
        where,
        _sum: {
          audioPacketsSent: true,
          audioPacketsReceived: true,
        },
        _avg: { lastLatencyMs: true },
      }),
    ]);

    return {
      realtimeSessions: total,
      activeRealtimeSessions: active,
      failedRealtimeSessions: failed,
      realtimeConnectionSuccessRate: total === 0 ? 0 : Math.round((connected / total) * 100),
      realtimeAudioPacketsSent: packetAggregate._sum.audioPacketsSent ?? 0,
      realtimeAudioPacketsReceived: packetAggregate._sum.audioPacketsReceived ?? 0,
      averageRealtimeLatencyMs: Math.round(packetAggregate._avg.lastLatencyMs ?? 0),
    };
  }

  createAuditEvent(input: {
    organizationId: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }
}
