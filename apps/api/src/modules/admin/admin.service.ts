import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { PasswordService } from "../../security/password.service";
import { BillingService } from "../billing/billing.service";
import { ExternalNumberService } from "../external-number/external-number.service";
import { PortRequestService } from "../port-request/port-request.service";
import { OrganizationLocaleService } from "../organization-locale/organization-locale.service";
import type { AdminUpdatePortRequestDto } from "../port-request/dto/port-request.dto";
import { AdminAuditService } from "./admin-audit.service";
import type { AdminJwtPayload } from "./admin.types";
import type {
  AdminFeatureOverrideDto,
  AdminListQueryDto,
  AdminLoginDto,
  AdminOrganizationLocalizationDto,
  AdminPlanOverrideDto,
  AdminStatusDto,
  AgentStatusDto,
  CreateSupportTicketDto,
  DeleteConfirmDto,
  GrantTrialDto,
  ResetUserPasswordDto,
  UpdateSupportTicketDto,
  UserStatusDto,
} from "./dto/admin.dto";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AdminAuditService,
    private readonly billing: BillingService,
    private readonly externalNumbersService: ExternalNumberService,
    private readonly portRequestsService: PortRequestService,
    private readonly locales: OrganizationLocaleService,
  ) {}

  portRequests() {
    return this.portRequestsService.adminList();
  }

  portRequest(id: string) {
    return this.portRequestsService.adminGet(id);
  }

  async updatePortRequest(
    admin: AdminJwtPayload,
    id: string,
    input: AdminUpdatePortRequestDto,
    ipAddress?: string | null,
  ) {
    const result = await this.portRequestsService.adminUpdate(id, input, admin.adminUserId);
    await this.audit.log({
      admin,
      action: "admin.port_request_updated",
      resourceType: "PortRequest",
      resourceId: id,
      metadata: { status: input.status },
      ipAddress,
    });
    return result;
  }

  async portRequestLoa(id: string) {
    const request = await this.portRequestsService.adminGet(id);
    return this.portRequestsService.loaDownload(request.organizationId, id);
  }

  leadImports(limit = 250) {
    return this.prisma.leadImport.findMany({
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        campaign: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  async login(input: AdminLoginDto, ipAddress?: string | null) {
    const email = input.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const invalid = new UnauthorizedException("Invalid admin email or password.");
    if (!admin) throw invalid;
    if (admin.status !== "ACTIVE") throw new ForbiddenException("Admin account is suspended.");
    if (!(await this.passwords.verify(input.password, admin.passwordHash))) throw invalid;
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.log({
      admin: { adminUserId: admin.id },
      action: "admin.login",
      resourceType: "AdminUser",
      resourceId: admin.id,
      ipAddress,
    });
    const payload: AdminJwtPayload = {
      adminUserId: admin.id,
      email: admin.email,
      role: "SUPER_ADMIN",
      tokenUse: "admin",
    };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>("jwt.accessSecret"),
        expiresIn: this.config.getOrThrow<string>("jwt.accessExpiresIn") as never,
      }),
      admin: this.adminSummary(admin),
    };
  }

  async me(admin: AdminJwtPayload) {
    const record = await this.prisma.adminUser.findUnique({ where: { id: admin.adminUserId } });
    if (!record || record.status !== "ACTIVE") throw new UnauthorizedException("Admin not found.");
    return { admin: this.adminSummary(record) };
  }

  async dashboard() {
    const [
      organizations,
      users,
      agents,
      calls,
      activeSubscriptions,
      trialAccounts,
      openTickets,
      revenue,
      mrrRows,
      subscriptionDistribution,
      recentOrganizations,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.agent.count({ where: { deletedAt: null } }),
      this.prisma.call.count(),
      this.prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
      this.prisma.organization.count({ where: { trialStatus: "ACTIVE", deletedAt: null } }),
      this.prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
      this.revenue(),
      this.prisma.analyticsMetricSnapshot.findMany({
        where: { metricKey: "mrr" },
        orderBy: { snapshotDate: "desc" },
        take: 50,
      }),
      this.prisma.subscription.groupBy({
        by: ["plan"],
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        _count: { _all: true },
      }),
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, status: true, plan: true, createdAt: true },
      }),
    ]);
    return {
      totals: {
        organizations,
        users,
        agents,
        calls,
        revenue,
        mrr: mrrRows.reduce((total, row) => total + Number(row.metricValue), 0),
        activeSubscriptions,
        trialAccounts,
        openSupportTickets: openTickets,
      },
      subscriptionDistribution: Object.fromEntries(
        subscriptionDistribution.map((row) => [row.plan, row._count._all]),
      ),
      recentOrganizations,
    };
  }

  organizations(query: AdminListQueryDto) {
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { slug: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        industry: true,
        companySize: true,
        provisionStatus: true,
        country: true,
        currency: true,
        timezone: true,
        language: true,
        telephonyProvider: true,
        paymentProvider: true,
        taxRegion: true,
        trialEndsAt: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            agents: true,
            calls: true,
            subscriptions: true,
            supportTickets: true,
          },
        },
      },
    });
  }

  customers(query: AdminListQueryDto) {
    return this.prisma.customerProfile.findMany({
      where: query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { phone: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { company: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {},
      include: {
        organization: { select: { id: true, name: true } },
        contact: { include: { leads: true, appointments: true, communicationThreads: true } },
      },
      orderBy: { lastContactAt: "desc" },
      take: 250,
    });
  }

  async customerTimeline(
    customerProfileId: string,
    input: { cursor?: string; limit?: number } = {},
  ) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { id: true, organization: { select: { id: true, name: true } } },
    });
    if (!customer) throw new NotFoundException("Customer profile not found.");
    const cursor = input.cursor ? decodeTimelineCursor(input.cursor) : null;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const events = await this.prisma.customerTimelineEvent.findMany({
      where: {
        customerProfileId,
        ...(cursor
          ? {
              OR: [
                { occurredAt: { lt: cursor.occurredAt } },
                { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const data = events.slice(0, limit);
    const last = data.at(-1);
    return {
      customer,
      data,
      nextCursor:
        events.length > limit && last ? encodeTimelineCursor(last.occurredAt, last.id) : null,
    };
  }

  async organizationDetails(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { billingCustomer: true },
        },
        usageCounters: { orderBy: { updatedAt: "desc" }, take: 25 },
        analyticsDailyMetrics: { orderBy: { date: "desc" }, take: 30 },
        featureOverrides: true,
        _count: {
          select: {
            members: true,
            agents: true,
            calls: true,
            leads: true,
            appointments: true,
            documents: true,
            supportTickets: true,
          },
        },
      },
    });
    if (!organization) throw new NotFoundException("Organization not found.");
    return organization;
  }

  async setOrganizationStatus(
    admin: AdminJwtPayload,
    id: string,
    input: AdminStatusDto,
    ipAddress?: string | null,
  ) {
    const organization = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id },
        data: { status: input.status },
      });
      if (input.status === "SUSPENDED" || input.status === "ARCHIVED") {
        await tx.refreshToken.updateMany({
          where: {
            revokedAt: null,
            user: {
              memberships: { some: { organizationId: id, deletedAt: null } },
            },
          },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
    await this.audit.log({
      admin,
      action: "admin.organization.status_changed",
      resourceType: "Organization",
      resourceId: id,
      metadata: { status: input.status, reason: input.reason },
      ipAddress,
    });
    return organization;
  }

  async setOrganizationLocalization(
    admin: AdminJwtPayload,
    id: string,
    input: AdminOrganizationLocalizationDto,
    ipAddress?: string | null,
  ) {
    const defaults = this.locales.defaults(input.country);
    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        country: defaults.country,
        countryCode: defaults.countryCode,
        currency: defaults.currency,
        timezone: input.timezone?.trim() || defaults.timezone,
        language: input.language ?? defaults.language,
        telephonyProvider: defaults.telephonyProvider,
        paymentProvider: defaults.paymentProvider,
        dateFormat: defaults.dateFormat,
        timeFormat: defaults.timeFormat,
        numberFormat: defaults.numberFormat,
        businessHoursTimezone:
          input.businessHoursTimezone?.trim() || defaults.businessHoursTimezone,
        taxRegion: input.taxRegion?.trim() || defaults.taxRegion,
      },
    });
    this.locales.invalidate(id);
    await this.audit.log({
      admin,
      action: "admin.organization.localization_changed",
      resourceType: "Organization",
      resourceId: id,
      metadata: {
        country: organization.country,
        currency: organization.currency,
        telephonyProvider: organization.telephonyProvider,
        paymentProvider: organization.paymentProvider,
        reason: input.reason,
      },
      ipAddress,
    });
    return organization;
  }

  async deleteOrganization(
    admin: AdminJwtPayload,
    id: string,
    input: DeleteConfirmDto,
    ipAddress?: string | null,
  ) {
    if (input.confirmation !== "ARCHIVE" && input.confirmation !== "DELETE") {
      throw new BadRequestException("Confirmation is required.");
    }
    const organization = await this.prisma.organization.update({
      where: { id },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
    await this.audit.log({
      admin,
      action: "admin.organization.archived",
      resourceType: "Organization",
      resourceId: id,
      metadata: { reason: input.reason, confirmation: input.confirmation },
      ipAddress,
    });
    return organization;
  }

  users(query: AdminListQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.organizationId
        ? { memberships: { some: { organizationId: query.organizationId, deletedAt: null } } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: "insensitive" } },
              { firstName: { contains: query.q, mode: "insensitive" } },
              { lastName: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        memberships: {
          where: { deletedAt: null },
          select: { role: true, organization: { select: { id: true, name: true, status: true } } },
        },
      },
    });
  }

  async setUserStatus(
    admin: AdminJwtPayload,
    id: string,
    input: UserStatusDto,
    ipAddress?: string | null,
  ) {
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { status: input.status } });
      if (input.status === "SUSPENDED") {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
    await this.audit.log({
      admin,
      action: "admin.user.status_changed",
      resourceType: "User",
      resourceId: id,
      metadata: { status: input.status, reason: input.reason },
      ipAddress,
    });
    return { id: user.id, status: user.status };
  }

  async resetUserPassword(
    admin: AdminJwtPayload,
    id: string,
    input: ResetUserPasswordDto,
    ipAddress?: string | null,
  ) {
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.audit.log({
      admin,
      action: "admin.user.password_reset",
      resourceType: "User",
      resourceId: id,
      metadata: { reason: input.reason },
      ipAddress,
    });
    return { success: true };
  }

  agents(query: AdminListQueryDto) {
    return this.prisma.agent.findMany({
      where: {
        deletedAt: null,
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        _count: { select: { calls: true, leads: true, appointments: true } },
      },
    });
  }

  async setAgentStatus(
    admin: AdminJwtPayload,
    id: string,
    input: AgentStatusDto,
    ipAddress?: string | null,
  ) {
    const agent = await this.prisma.agent.update({ where: { id }, data: { status: input.status } });
    await this.audit.log({
      admin,
      action: "admin.agent.status_changed",
      resourceType: "Agent",
      resourceId: id,
      metadata: { status: input.status, reason: input.reason },
      ipAddress,
    });
    return { id: agent.id, status: agent.status };
  }

  calls(query: AdminListQueryDto) {
    return this.prisma.call.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q
          ? {
              OR: [
                { twilioCallSid: { contains: query.q, mode: "insensitive" } },
                { callerNumber: { contains: query.q } },
                { calledNumber: { contains: query.q } },
              ],
            }
          : {}),
      },
      orderBy: { startedAt: "desc" },
      take: 100,
      select: {
        id: true,
        twilioCallSid: true,
        direction: true,
        status: true,
        startedAt: true,
        durationSeconds: true,
        callerNumber: true,
        calledNumber: true,
        organization: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
        callRecordingId: true,
        callTranscriptId: true,
      },
    });
  }

  outboundCalls(query: AdminListQueryDto) {
    return this.prisma.outboundCall.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q
          ? {
              OR: [
                { providerCallSid: { contains: query.q, mode: "insensitive" } },
                { reasonDescription: { contains: query.q, mode: "insensitive" } },
                { customerProfile: { name: { contains: query.q, mode: "insensitive" } } },
                { customerProfile: { phone: { contains: query.q } } },
              ],
            }
          : {}),
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
      include: {
        organization: { select: { id: true, name: true } },
        customerProfile: { select: { id: true, name: true, phone: true, email: true } },
        lead: { select: { id: true, status: true, score: true } },
        agent: { select: { id: true, name: true } },
        call: { select: { id: true, status: true, durationSeconds: true } },
        summary: { select: { id: true, outcome: true, sentiment: true } },
      },
    });
  }

  callSummaries(query: AdminListQueryDto & { sentiment?: string; outcome?: string }) {
    return this.prisma.callSummary.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.sentiment ? { sentiment: query.sentiment as never } : {}),
        ...(query.outcome ? { outcome: query.outcome as never } : {}),
        ...(query.q
          ? {
              OR: [
                { summary: { contains: query.q, mode: "insensitive" } },
                { intent: { contains: query.q, mode: "insensitive" } },
                { nextAction: { contains: query.q, mode: "insensitive" } },
                { customerProfile: { name: { contains: query.q, mode: "insensitive" } } },
                { call: { callerNumber: { contains: query.q } } },
              ],
            }
          : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
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
      },
      orderBy: { generatedAt: "desc" },
      take: 100,
    });
  }

  phoneNumbers(query: AdminListQueryDto) {
    return this.prisma.phoneNumber.findMany({
      where: {
        deletedAt: null,
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q
          ? {
              OR: [
                { phoneNumber: { contains: query.q, mode: "insensitive" } },
                { friendlyName: { contains: query.q, mode: "insensitive" } },
                { countryCode: { contains: query.q, mode: "insensitive" } },
                { twilioSid: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        phoneNumber: true,
        friendlyName: true,
        status: true,
        countryCode: true,
        areaCode: true,
        capabilities: true,
        provider: true,
        purchaseSource: true,
        isPurchased: true,
        twilioSid: true,
        providerCost: true,
        customerPrice: true,
        profitMargin: true,
        purchasedAt: true,
        releasedAt: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true, status: true } },
      },
    });
  }

  externalNumbers(query: AdminListQueryDto) {
    return this.prisma.externalPhoneNumber.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q
          ? {
              OR: [
                { phoneNumber: { contains: query.q, mode: "insensitive" as const } },
                { forwardingTargetNumber: { contains: query.q, mode: "insensitive" as const } },
                { organization: { name: { contains: query.q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        organization: { select: { id: true, name: true } },
        assignedAgent: { select: { id: true, name: true, status: true } },
        forwardingTargetPhoneNumber: { select: { id: true, phoneNumber: true, status: true } },
      },
    });
  }

  async disableExternalNumber(admin: AdminJwtPayload, id: string, ipAddress?: string | null) {
    const record = await this.prisma.externalPhoneNumber.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Existing phone number not found.");
    const result = await this.externalNumbersService.adminDisable(record.organizationId, id);
    await this.audit.log({
      admin,
      action: "admin.external_number.disabled",
      resourceType: "ExternalPhoneNumber",
      resourceId: id,
      metadata: { organizationId: record.organizationId },
      ipAddress,
    });
    return result;
  }

  async assignExternalNumber(
    admin: AdminJwtPayload,
    id: string,
    agentId: string | null,
    ipAddress?: string | null,
  ) {
    const record = await this.prisma.externalPhoneNumber.findUnique({ where: { id } });
    if (!record) throw new NotFoundException("Existing phone number not found.");
    const result = await this.externalNumbersService.adminAssign(
      record.organizationId,
      id,
      agentId,
    );
    await this.audit.log({
      admin,
      action: "admin.external_number.reassigned",
      resourceType: "ExternalPhoneNumber",
      resourceId: id,
      metadata: { organizationId: record.organizationId, agentId },
      ipAddress,
    });
    return result;
  }

  subscriptions(query: AdminListQueryDto) {
    return this.prisma.subscription.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        organization: { select: { id: true, name: true, status: true } },
        billingCustomer: { select: { providerCustomerId: true, email: true } },
      },
    });
  }

  payments(query: AdminListQueryDto) {
    return this.prisma.billingEvent.findMany({
      where: {
        eventType: { in: ["invoice.payment_succeeded", "invoice.payment_failed"] },
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        processed: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        payload: true,
      },
    });
  }

  knowledgeBases(query: AdminListQueryDto) {
    return this.prisma.knowledgeBase.findMany({
      where: {
        deletedAt: null,
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        _count: { select: { documents: true, knowledgeChunks: true } },
      },
    });
  }

  documents(query: AdminListQueryDto) {
    return this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        fileSize: true,
        uploadStatus: true,
        processingStatus: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        knowledgeBase: { select: { id: true, name: true } },
        _count: { select: { chunks: true } },
      },
    });
  }

  async deleteDocument(
    admin: AdminJwtPayload,
    id: string,
    input: DeleteConfirmDto,
    ipAddress?: string | null,
  ) {
    if (input.confirmation !== "DELETE")
      throw new BadRequestException("DELETE confirmation required.");
    const document = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date(), uploadStatus: "FAILED", processingStatus: "FAILED" },
    });
    await this.audit.log({
      admin,
      action: "admin.document.deleted",
      resourceType: "Document",
      resourceId: id,
      metadata: { reason: input.reason },
      ipAddress,
    });
    return document;
  }

  async changePlan(
    admin: AdminJwtPayload,
    organizationId: string,
    input: AdminPlanOverrideDto,
    ipAddress?: string | null,
  ) {
    const result = await this.billing.adminChangePlan(organizationId, input.plan);
    await this.audit.log({
      admin,
      action: "admin.subscription.plan_override",
      resourceType: "Organization",
      resourceId: organizationId,
      metadata: { plan: input.plan, reason: input.reason, pendingWebhook: true },
      ipAddress,
    });
    return result;
  }

  async cancelSubscription(
    admin: AdminJwtPayload,
    organizationId: string,
    input: { mode?: "IMMEDIATE" | "PERIOD_END"; reason: string },
    ipAddress?: string | null,
  ) {
    const result = await this.billing.adminCancel(organizationId, input.mode ?? "PERIOD_END");
    await this.audit.log({
      admin,
      action: "admin.subscription.cancellation_requested",
      resourceType: "Subscription",
      resourceId: organizationId,
      metadata: { mode: input.mode ?? "PERIOD_END", reason: input.reason, pendingWebhook: true },
      ipAddress,
    });
    return result;
  }

  async resumeSubscription(
    admin: AdminJwtPayload,
    organizationId: string,
    reason: string,
    ipAddress?: string | null,
  ) {
    const result = await this.billing.adminResume(organizationId);
    await this.audit.log({
      admin,
      action: "admin.subscription.resume_requested",
      resourceType: "Subscription",
      resourceId: organizationId,
      metadata: { reason, pendingWebhook: true },
      ipAddress,
    });
    return result;
  }

  async applyOverride(
    admin: AdminJwtPayload,
    organizationId: string,
    input: AdminFeatureOverrideDto,
    ipAddress?: string | null,
  ) {
    const override = await this.prisma.organizationFeatureOverride.upsert({
      where: { organizationId_feature: { organizationId, feature: input.feature } },
      update: {
        enabled: input.enabled,
        limit: input.limit,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        metadata: { reason: input.reason },
      },
      create: {
        organizationId,
        feature: input.feature,
        enabled: input.enabled,
        limit: input.limit,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        metadata: { reason: input.reason },
      },
    });
    await this.audit.log({
      admin,
      action: "admin.feature_override.applied",
      resourceType: "OrganizationFeatureOverride",
      resourceId: override.id,
      metadata: { organizationId, feature: input.feature, reason: input.reason },
      ipAddress,
    });
    return override;
  }

  async grantTrial(
    admin: AdminJwtPayload,
    organizationId: string,
    input: GrantTrialDto,
    ipAddress?: string | null,
  ) {
    const now = new Date();
    const days = Math.max(1, Math.min(30, Number(input.days ?? 14)));
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: "STARTER",
        status: "ACTIVE",
        trialStatus: "ACTIVE",
        trialStartsAt: now,
        trialEndsAt: new Date(now.getTime() + days * 86_400_000),
      },
    });
    await this.audit.log({
      admin,
      action: "admin.trial.granted",
      resourceType: "Organization",
      resourceId: organizationId,
      metadata: { days, reason: input.reason },
      ipAddress,
    });
    return organization;
  }

  tickets(query: AdminListQueryDto) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.q ? { subject: { contains: query.q, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        organization: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedAdmin: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async createTicket(
    admin: AdminJwtPayload,
    input: CreateSupportTicketDto,
    ipAddress?: string | null,
  ) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        subject: input.subject.trim(),
        priority: input.priority ?? "NORMAL",
      },
    });
    await this.audit.log({
      admin,
      action: "admin.ticket.created",
      resourceType: "SupportTicket",
      resourceId: ticket.id,
      metadata: { organizationId: input.organizationId },
      ipAddress,
    });
    return ticket;
  }

  async updateTicket(
    admin: AdminJwtPayload,
    id: string,
    input: UpdateSupportTicketDto,
    ipAddress?: string | null,
  ) {
    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: input.status,
        priority: input.priority,
        assignedAdminId: input.assignedAdminId,
        metadata: input.reply
          ? { lastReply: input.reply, repliedAt: new Date().toISOString() }
          : undefined,
      },
    });
    await this.audit.log({
      admin,
      action: "admin.ticket.updated",
      resourceType: "SupportTicket",
      resourceId: id,
      metadata: input as unknown as Prisma.InputJsonValue,
      ipAddress,
    });
    return ticket;
  }

  auditLogs(query: AdminListQueryDto) {
    return this.prisma.adminAuditLog.findMany({
      where: query.q
        ? {
            OR: [
              { action: { contains: query.q, mode: "insensitive" } },
              { resourceType: { contains: query.q, mode: "insensitive" } },
              { resourceId: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        adminUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async search(query: string) {
    const q = query.trim();
    if (q.length < 2)
      return {
        organizations: [],
        users: [],
        agents: [],
        calls: [],
        subscriptions: [],
        tickets: [],
      };
    const [organizations, users, agents, calls, subscriptions, tickets] = await Promise.all([
      this.organizations({ q }),
      this.users({ q }),
      this.agents({ q }),
      this.calls({ q }),
      this.prisma.subscription.findMany({
        where: {
          OR: [
            { providerSubscriptionId: { contains: q, mode: "insensitive" } },
            { billingCustomer: { providerCustomerId: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: 20,
        include: { organization: { select: { id: true, name: true } } },
      }),
      this.tickets({ q }),
    ]);
    return { organizations, users, agents, calls, subscriptions, tickets };
  }

  private async revenue() {
    const rows = await this.prisma.$queryRaw<Array<{ value: number }>>`
      SELECT COALESCE(SUM(NULLIF(payload #>> '{data,object,amount_paid}', '')::numeric), 0) / 100 AS value
      FROM billing_events
      WHERE "eventType" = 'invoice.payment_succeeded'
    `;
    return Number(rows[0]?.value ?? 0);
  }

  private adminSummary(admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: "SUPER_ADMIN";
  }) {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
    };
  }
}

function encodeTimelineCursor(occurredAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id })).toString(
    "base64url",
  );
}

function decodeTimelineCursor(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      occurredAt?: string;
      id?: string;
    };
    const occurredAt = new Date(parsed.occurredAt ?? "");
    if (!parsed.id || Number.isNaN(occurredAt.getTime())) throw new Error();
    return { occurredAt, id: parsed.id };
  } catch {
    throw new BadRequestException("Invalid timeline cursor.");
  }
}
