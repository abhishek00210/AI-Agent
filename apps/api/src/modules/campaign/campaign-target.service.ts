import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import type { CampaignTargetingDto } from "./dto/campaign.dto";

@Injectable()
export class CampaignTargetService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: {
    organizationId: string;
    customerProfileIds?: string[];
    targeting?: CampaignTargetingDto;
  }) {
    const explicitIds = [...new Set(input.customerProfileIds ?? [])];
    const where: Prisma.CustomerProfileWhereInput = {
      organizationId: input.organizationId,
      phone: { not: null },
      ...(explicitIds.length ? { id: { in: explicitIds } } : {}),
      ...(input.targeting?.customerStatuses?.length
        ? { leadStatus: { in: input.targeting.customerStatuses } }
        : {}),
      ...(input.targeting?.lastContactBefore || input.targeting?.lastContactAfter
        ? {
            lastContactAt: {
              ...(input.targeting.lastContactBefore
                ? { lte: new Date(input.targeting.lastContactBefore) }
                : {}),
              ...(input.targeting.lastContactAfter
                ? { gte: new Date(input.targeting.lastContactAfter) }
                : {}),
            },
          }
        : {}),
      ...(input.targeting?.customerType
        ? { leadStatus: input.targeting.customerType }
        : {}),
      contact: {
        deletedAt: null,
        ...(input.targeting?.tags?.length ? { tags: { hasSome: input.targeting.tags } } : {}),
        ...(input.targeting?.leadStatuses?.length
          ? { leads: { some: { status: { in: input.targeting.leadStatuses }, deletedAt: null } } }
          : {}),
        ...(input.targeting?.appointmentStatuses?.length
          ? { appointments: { some: { status: { in: input.targeting.appointmentStatuses } } } }
          : {}),
      },
    };
    const profiles = await this.prisma.customerProfile.findMany({
      where,
      select: {
        id: true,
        contactId: true,
        contact: {
          select: {
            leads: {
              where: { organizationId: input.organizationId, deletedAt: null },
              select: { id: true },
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { lastContactAt: "asc" },
      take: 10_000,
    });
    if (explicitIds.length && profiles.length !== explicitIds.length) {
      throw new BadRequestException("One or more campaign customers are invalid, unreachable, or belong to another organization.");
    }
    if (!profiles.length) throw new BadRequestException("No callable customers match these campaign filters.");
    return profiles.map((profile) => ({
      customerProfileId: profile.id,
      leadId: profile.contact.leads[0]?.id ?? null,
    }));
  }
}
