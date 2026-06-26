import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import type { Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";
import { OrganizationProvisioningService } from "../../organization-locale/organization-provisioning.service";

@Injectable()
export class UserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: OrganizationProvisioningService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  findById(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: {
        memberships: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
  }

  createWithDefaultOrganization(input: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    country: "CA" | "IN";
    organizationName: string;
    industry: string;
    companySize?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const organizationName = input.organizationName.trim();
      const trialStartsAt = new Date();
      const trialEndsAt = new Date(trialStartsAt.getTime() + 14 * 24 * 60 * 60 * 1_000);
      const locale = this.provisioning.metadata(input.country);
      const organization = await tx.organization.create({
        data: this.provisioning.buildCreateData({
          name: organizationName,
          slug: `${slugify(organizationName)}-${cryptoRandomSuffix()}`,
          country: input.country,
          industry: input.industry,
          companySize: input.companySize,
          trialStartsAt,
          trialEndsAt,
        }),
      });

      const user = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: "ACTIVE",
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: organization.id,
          actorUserId: user.id,
          action: "billing.trial_started",
          entityType: "Organization",
          entityId: organization.id,
          metadata: {
            plan: "STARTER",
            trialStartsAt,
            trialEndsAt,
            country: locale.country,
            currency: locale.currency,
            telephonyProvider: locale.telephonyProvider,
            paymentProvider: locale.paymentProvider,
          },
        },
      });

      await tx.auditEvent.createMany({
        data: [
          {
            organizationId: organization.id,
            actorUserId: user.id,
            action: "organization.created",
            entityType: "Organization",
            entityId: organization.id,
            metadata: {
              industry: input.industry,
              companySize: input.companySize ?? null,
              provisionStatus: organization.provisionStatus,
            },
          },
          {
            organizationId: organization.id,
            actorUserId: user.id,
            action: "organization.country_selected",
            entityType: "Organization",
            entityId: organization.id,
            metadata: locale,
          },
          {
            organizationId: organization.id,
            actorUserId: user.id,
            action: "organization.providers_assigned",
            entityType: "Organization",
            entityId: organization.id,
            metadata: {
              telephonyProvider: locale.telephonyProvider,
              paymentProvider: locale.paymentProvider,
            },
          },
          {
            organizationId: organization.id,
            actorUserId: user.id,
            action: "organization.owner_created",
            entityType: "OrganizationMember",
            metadata: { userId: user.id, role: "OWNER" },
          },
          {
            organizationId: organization.id,
            actorUserId: user.id,
            action: "organization.subscription_initialized",
            entityType: "Organization",
            entityId: organization.id,
            metadata: { plan: "STARTER", trialStartsAt, trialEndsAt, source: "TRIAL" },
          },
        ],
      });

      await tx.analyticsEvent.createMany({
        data: [
          {
            organizationId: organization.id,
            eventType: "ORGANIZATION_CREATED",
            idempotencyKey: `signup:organization:${organization.id}`,
            metricDate: day(new Date()),
            metadata: {
              country: locale.country,
              currency: locale.currency,
              telephonyProvider: locale.telephonyProvider,
              paymentProvider: locale.paymentProvider,
              industry: input.industry,
            },
          },
          {
            organizationId: organization.id,
            eventType: "SIGNUP_COMPLETED",
            idempotencyKey: `signup:completed:${user.id}`,
            metricDate: day(new Date()),
            metadata: {
              country: locale.country,
              step: "FINISH",
              completionRate: 100,
            },
          },
        ],
        skipDuplicates: true,
      });

      return { user, organization };
    });
  }

  updatePassword(userId: string, passwordHash: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    return client.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

function cryptoRandomSuffix(): string {
  return randomBytes(4).toString("hex");
}

function day(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
