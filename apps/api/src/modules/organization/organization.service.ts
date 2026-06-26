import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { MemberRole } from "@ai-agent-platform/types";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { OrganizationRepository } from "./repositories/organization.repository";
import { GreetingService } from "../customer-memory/greeting.service";
import { OrganizationLocaleService } from "../organization-locale/organization-locale.service";
import type {
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
  UpdateGreetingSettingsDto,
} from "./dto/organization.dto";

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly greetings: GreetingService,
    private readonly locales: OrganizationLocaleService,
  ) {}

  async getCurrent(context: TenantContext) {
    const organization = await this.organizations.findCurrent(context.organizationId);

    if (!organization) {
      throw new NotFoundException("Organization not found.");
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      status: organization.status,
      industry: organization.industry,
      companySize: organization.companySize,
      provisionStatus: organization.provisionStatus,
      country: organization.country,
      countryCode: organization.countryCode,
      currency: organization.currency,
      timezone: organization.timezone,
      language: organization.language,
      telephonyProvider: organization.telephonyProvider,
      paymentProvider: organization.paymentProvider,
      dateFormat: organization.dateFormat,
      timeFormat: organization.timeFormat,
      numberFormat: organization.numberFormat,
      businessHoursTimezone: organization.businessHoursTimezone,
      gstNumber: organization.gstNumber,
      billingCompanyName: organization.billingCompanyName,
      billingAddress: organization.billingAddress,
      taxRegion: organization.taxRegion,
      memberCount: organization._count.members,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      greetingSettings: {
        enabled: organization.personalizedGreetingsEnabled,
        recencyWindowDays: organization.greetingRecencyWindowDays,
        confidenceThreshold: organization.greetingConfidenceThreshold,
      },
    };
  }

  async updateCurrent(context: TenantContext, input: UpdateOrganizationDto) {
    this.assertCanManageOrganization(context.role);
    const targetCountry = input.country ?? input.countryCode;
    const current = targetCountry
      ? await this.organizations.findCurrent(context.organizationId)
      : null;
    const countryChanged = Boolean(targetCountry && current?.country !== targetCountry);
    const defaults = targetCountry ? this.locales.defaults(targetCountry) : undefined;
    const organization = await this.organizations.updateCurrent(context.organizationId, {
      name: input.name?.trim(),
      country: defaults?.country,
      countryCode: defaults?.countryCode ?? input.countryCode,
      currency: countryChanged ? defaults?.currency : (input.currency ?? defaults?.currency),
      timezone: countryChanged ? defaults?.timezone : (input.timezone?.trim() || defaults?.timezone),
      language: countryChanged ? defaults?.language : (input.language ?? defaults?.language),
      telephonyProvider: countryChanged
        ? defaults?.telephonyProvider
        : (input.telephonyProvider ?? defaults?.telephonyProvider),
      paymentProvider: countryChanged
        ? defaults?.paymentProvider
        : (input.paymentProvider ?? defaults?.paymentProvider),
      dateFormat: countryChanged ? defaults?.dateFormat : (input.dateFormat?.trim() || defaults?.dateFormat),
      timeFormat: countryChanged ? defaults?.timeFormat : (input.timeFormat?.trim() || defaults?.timeFormat),
      numberFormat: countryChanged ? defaults?.numberFormat : (input.numberFormat?.trim() || defaults?.numberFormat),
      businessHoursTimezone:
        countryChanged
          ? defaults?.businessHoursTimezone
          : (input.businessHoursTimezone?.trim() || defaults?.businessHoursTimezone),
      gstNumber: input.gstNumber?.trim() || undefined,
      billingCompanyName: input.billingCompanyName?.trim() || undefined,
      billingAddress: input.billingAddress as Prisma.InputJsonValue | undefined,
      taxRegion: countryChanged ? defaults?.taxRegion : (input.taxRegion?.trim() || defaults?.taxRegion),
    });
    this.locales.invalidate(context.organizationId);
    await this.audit(context, "organization.updated", "Organization", organization.id, {
      name: organization.name,
      country: organization.country,
      countryCode: organization.countryCode,
      currency: organization.currency,
      timezone: organization.timezone,
      telephonyProvider: organization.telephonyProvider,
      paymentProvider: organization.paymentProvider,
    });
    return organization;
  }

  greetingSettings(context: TenantContext) {
    return this.greetings.settings(context.organizationId);
  }

  async updateGreetingSettings(context: TenantContext, input: UpdateGreetingSettingsDto) {
    this.assertCanManageOrganization(context.role);
    return this.greetings.updateSettings(context.organizationId, input, context.userId);
  }

  async listMembers(context: TenantContext) {
    const members = await this.organizations.listMembers(context.organizationId);

    return members.map((member) => ({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: {
        id: member.user.id,
        email: member.user.email,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        status: member.user.status,
      },
    }));
  }

  async inviteMember(context: TenantContext, input: InviteMemberDto) {
    this.assertCanManageMembers(context.role);

    if (input.role === "OWNER") {
      this.assertOwner(context.role);
    }

    const invitation = await this.organizations.createInvitation({
      organizationId: context.organizationId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      invitedById: context.userId,
    });

    await this.audit(context, "member.invited", "OrganizationInvitation", invitation.id, {
      email: invitation.email,
      role: invitation.role,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async updateMemberRole(context: TenantContext, memberId: string, input: UpdateMemberRoleDto) {
    this.assertCanManageMembers(context.role);
    const member = await this.getScopedMember(context.organizationId, memberId);

    if (input.role === "OWNER") {
      this.assertOwner(context.role);
    }

    if (member.role === "OWNER" && input.role !== "OWNER") {
      await this.assertNotLastOwner(context.organizationId);
    }

    await this.organizations.updateMemberRole(context.organizationId, memberId, input.role);
    await this.audit(context, "member.role_changed", "OrganizationMember", memberId, {
      from: member.role,
      to: input.role,
    });

    return this.getScopedMember(context.organizationId, memberId);
  }

  async removeMember(context: TenantContext, memberId: string) {
    this.assertCanManageMembers(context.role);
    const member = await this.getScopedMember(context.organizationId, memberId);

    if (member.role === "OWNER") {
      throw new BadRequestException("Organization owners cannot be removed.");
    }

    await this.organizations.removeMember(context.organizationId, memberId);
    await this.audit(context, "member.removed", "OrganizationMember", memberId, {
      email: member.user.email,
      role: member.role,
    });

    return { success: true };
  }

  private async getScopedMember(organizationId: string, memberId: string) {
    const member = await this.organizations.findMember(organizationId, memberId);

    if (!member) {
      throw new NotFoundException("Organization member not found.");
    }

    return member;
  }

  private assertCanManageOrganization(role: MemberRole) {
    if (role !== "OWNER" && role !== "ADMIN") {
      throw new ForbiddenException("You do not have permission to manage this organization.");
    }
  }

  private assertCanManageMembers(role: MemberRole) {
    if (role !== "OWNER" && role !== "ADMIN") {
      throw new ForbiddenException("You do not have permission to manage members.");
    }
  }

  private assertOwner(role: MemberRole) {
    if (role !== "OWNER") {
      throw new ForbiddenException("Only organization owners can assign owner role.");
    }
  }

  private async assertNotLastOwner(organizationId: string) {
    const ownerCount = await this.organizations.countOwners(organizationId);

    if (ownerCount <= 1) {
      throw new BadRequestException("The last organization owner cannot be demoted.");
    }
  }

  private audit(
    context: TenantContext,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.organizations.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }
}
