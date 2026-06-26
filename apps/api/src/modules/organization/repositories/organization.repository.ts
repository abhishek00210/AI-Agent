import { Injectable } from "@nestjs/common";
import type { MemberRole } from "@ai-agent-platform/types";
import type {
  BillingProvider,
  Country,
  Currency,
  Language,
  PhoneNumberProvider,
  Prisma,
} from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCurrent(organizationId: string) {
    return this.prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            members: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  }

  updateCurrent(
    organizationId: string,
    input: {
      name?: string;
      country?: Country;
      countryCode?: Country;
      currency?: Currency;
      timezone?: string;
      language?: Language;
      telephonyProvider?: PhoneNumberProvider;
      paymentProvider?: BillingProvider;
      dateFormat?: string;
      timeFormat?: string;
      numberFormat?: string;
      businessHoursTimezone?: string;
      gstNumber?: string;
      billingCompanyName?: string;
      billingAddress?: Prisma.InputJsonValue;
      taxRegion?: string;
    },
  ) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.country ? { country: input.country } : {}),
        ...(input.countryCode ? { countryCode: input.countryCode } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.language ? { language: input.language } : {}),
        ...(input.telephonyProvider ? { telephonyProvider: input.telephonyProvider } : {}),
        ...(input.paymentProvider ? { paymentProvider: input.paymentProvider } : {}),
        ...(input.dateFormat ? { dateFormat: input.dateFormat } : {}),
        ...(input.timeFormat ? { timeFormat: input.timeFormat } : {}),
        ...(input.numberFormat ? { numberFormat: input.numberFormat } : {}),
        ...(input.businessHoursTimezone
          ? { businessHoursTimezone: input.businessHoursTimezone }
          : {}),
        ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber } : {}),
        ...(input.billingCompanyName !== undefined
          ? { billingCompanyName: input.billingCompanyName }
          : {}),
        ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
        ...(input.taxRegion !== undefined ? { taxRegion: input.taxRegion } : {}),
      },
    });
  }

  listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      include: {
        user: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  }

  findMember(organizationId: string, memberId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
        deletedAt: null,
      },
      include: {
        user: true,
      },
    });
  }

  countOwners(organizationId: string) {
    return this.prisma.organizationMember.count({
      where: {
        organizationId,
        role: "OWNER",
        deletedAt: null,
      },
    });
  }

  async createInvitation(input: {
    organizationId: string;
    email: string;
    role: MemberRole;
    invitedById: string;
  }) {
    return this.prisma.organizationInvitation.upsert({
      where: {
        organizationId_email: {
          organizationId: input.organizationId,
          email: input.email,
        },
      },
      update: {
        role: input.role,
        invitedById: input.invitedById,
        acceptedAt: null,
        expiresAt: invitationExpiry(),
      },
      create: {
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        invitedById: input.invitedById,
        expiresAt: invitationExpiry(),
      },
    });
  }

  updateMemberRole(organizationId: string, memberId: string, role: MemberRole) {
    return this.prisma.organizationMember.updateMany({
      where: {
        id: memberId,
        organizationId,
        deletedAt: null,
      },
      data: { role },
    });
  }

  removeMember(organizationId: string, memberId: string) {
    return this.prisma.organizationMember.updateMany({
      where: {
        id: memberId,
        organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
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
}

function invitationExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
