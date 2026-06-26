import { Injectable } from "@nestjs/common";
import type { CallSessionStatus, Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class CallSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCallByTwilioSid(twilioCallSid: string) {
    return this.prisma.call.findUnique({
      where: { twilioCallSid },
      select: {
        id: true,
        organizationId: true,
        twilioCallSid: true,
        agentId: true,
        phoneNumberId: true,
      },
    });
  }

  findByCallId(organizationId: string, callId: string) {
    return this.prisma.callSession.findMany({
      where: {
        organizationId,
        callId,
      },
      orderBy: { connectedAt: "desc" },
    });
  }

  findByStreamSid(streamSid: string) {
    return this.prisma.callSession.findUnique({
      where: { streamSid },
    });
  }

  upsertStarted(input: {
    callId: string;
    organizationId: string;
    twilioCallSid: string;
    streamSid: string;
  }) {
    const connectedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.callSession.upsert({
        where: { streamSid: input.streamSid },
        create: {
          callId: input.callId,
          organizationId: input.organizationId,
          twilioCallSid: input.twilioCallSid,
          streamSid: input.streamSid,
          status: "CONNECTED",
          connectedAt,
        },
        update: {
          status: "CONNECTED",
          connectedAt,
          disconnectedAt: null,
        },
      });
      await tx.call.updateMany({
        where: { id: input.callId, organizationId: input.organizationId, answeredAt: null },
        data: { status: "CONNECTED", answeredAt: connectedAt },
      });
      return session;
    });
  }

  close(streamSid: string, status: CallSessionStatus, packetCount: number) {
    return this.prisma.callSession.update({
      where: { streamSid },
      data: {
        status,
        packetCount: { increment: packetCount },
        ...(status === "DISCONNECTED" || status === "FAILED" ? { disconnectedAt: new Date() } : {}),
      },
    });
  }

  async stats(organizationId: string) {
    const where: Prisma.CallSessionWhereInput = { organizationId };
    const [totalStreams, connectedStreams, disconnectedStreams, failedStreams, packetAggregate] =
      await Promise.all([
        this.prisma.callSession.count({ where }),
        this.prisma.callSession.count({ where: { ...where, status: "CONNECTED" } }),
        this.prisma.callSession.count({ where: { ...where, status: "DISCONNECTED" } }),
        this.prisma.callSession.count({ where: { ...where, status: "FAILED" } }),
        this.prisma.callSession.aggregate({
          where,
          _sum: { packetCount: true },
        }),
      ]);

    return {
      totalStreams,
      connectedStreams,
      disconnectedStreams,
      failedStreams,
      packetsProcessed: packetAggregate._sum.packetCount ?? 0,
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
