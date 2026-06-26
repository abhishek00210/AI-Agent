import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import type { AdminJwtPayload } from "./admin.types";

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: {
    admin?: Pick<AdminJwtPayload, "adminUserId"> | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminUserId: input.admin?.adminUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress,
      },
    });
  }
}
