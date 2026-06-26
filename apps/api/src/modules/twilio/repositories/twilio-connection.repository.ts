import { Injectable } from "@nestjs/common";
import type { Prisma, TwilioConnectionStatus } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class TwilioConnectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCurrent(organizationId: string) {
    return this.prisma.twilioConnection.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }

  upsert(input: {
    organizationId: string;
    accountSid: string;
    friendlyName?: string | null;
    status: TwilioConnectionStatus;
  }) {
    return this.prisma.twilioConnection.upsert({
      where: {
        organizationId_accountSid: {
          organizationId: input.organizationId,
          accountSid: input.accountSid,
        },
      },
      create: input,
      update: {
        friendlyName: input.friendlyName,
        status: input.status,
        deletedAt: null,
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
    return this.prisma.auditEvent.create({ data: input });
  }
}
