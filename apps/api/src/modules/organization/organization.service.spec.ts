import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { OrganizationMemberRoleDto } from "./dto/organization.dto";
import type { TenantContext } from "../tenant/tenant.service";

describe("OrganizationService", () => {
  const repository = {
    findCurrent: jest.fn(),
    updateCurrent: jest.fn(),
    listMembers: jest.fn(),
    findMember: jest.fn(),
    countOwners: jest.fn(),
    createInvitation: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    createAuditEvent: jest.fn(),
  };
  const greetings = {
    settings: jest.fn(),
    updateSettings: jest.fn(),
  };
  const locales = {
    defaults: jest.fn((country: string) =>
      country === "IN"
        ? {
            country: "IN",
            countryCode: "IN",
            currency: "INR",
            timezone: "Asia/Kolkata",
            language: "en",
            telephonyProvider: "EXOTEL",
            paymentProvider: "RAZORPAY",
            dateFormat: "dd/MM/yyyy",
            timeFormat: "HH:mm",
            numberFormat: "+91",
            businessHoursTimezone: "Asia/Kolkata",
            taxRegion: "GST",
          }
        : {
            country: "CA",
            countryCode: "CA",
            currency: "CAD",
            timezone: "America/Toronto",
            language: "en",
            telephonyProvider: "TWILIO",
            paymentProvider: "STRIPE",
            dateFormat: "yyyy-MM-dd",
            timeFormat: "HH:mm",
            numberFormat: "+1",
            businessHoursTimezone: "America/Toronto",
            taxRegion: "GST/HST",
          },
    ),
    invalidate: jest.fn(),
  };
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService(repository as never, greetings as never, locales as never);
  });

  it("returns only the current tenant organization", async () => {
    repository.findCurrent.mockResolvedValue({
      id: "org-1",
      name: "Ada's Workspace",
      slug: "adas-workspace",
      plan: "FREE",
      status: "ACTIVE",
      country: "CA",
      countryCode: "CA",
      currency: "CAD",
      timezone: "America/Toronto",
      language: "en",
      telephonyProvider: "TWILIO",
      paymentProvider: "STRIPE",
      dateFormat: "yyyy-MM-dd",
      timeFormat: "HH:mm",
      numberFormat: "+1",
      businessHoursTimezone: "America/Toronto",
      taxRegion: "GST/HST",
      gstNumber: null,
      billingCompanyName: null,
      billingAddress: null,
      personalizedGreetingsEnabled: true,
      greetingRecencyWindowDays: 90,
      greetingConfidenceThreshold: "MEDIUM",
      memberCount: 1,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
      _count: { members: 1 },
    });

    const result = await service.getCurrent(context());

    expect(repository.findCurrent).toHaveBeenCalledWith("org-1");
    expect(result.id).toBe("org-1");
    expect(result.memberCount).toBe(1);
  });

  it("applies country defaults when owners change organization country", async () => {
    repository.findCurrent.mockResolvedValue({
      id: "org-1",
      country: "CA",
      countryCode: "CA",
      _count: { members: 1 },
    });
    repository.updateCurrent.mockResolvedValue({
      id: "org-1",
      name: "India Workspace",
      country: "IN",
      countryCode: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      telephonyProvider: "EXOTEL",
      paymentProvider: "RAZORPAY",
    });

    await service.updateCurrent(context(), { name: "India Workspace", country: "IN" });

    expect(repository.updateCurrent).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        telephonyProvider: "EXOTEL",
        paymentProvider: "RAZORPAY",
      }),
    );
    expect(locales.invalidate).toHaveBeenCalledWith("org-1");
  });

  it("blocks missing tenant organizations", async () => {
    repository.findCurrent.mockResolvedValue(null);
    await expect(service.getCurrent(context())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("allows owners to invite members and writes audit events", async () => {
    repository.createInvitation.mockResolvedValue({
      id: "invite-1",
      email: "new@example.com",
      role: "MEMBER",
      expiresAt: new Date("2026-01-08"),
      createdAt: new Date("2026-01-01"),
    });

    const result = await service.inviteMember(context(), {
      email: "NEW@example.com",
      role: OrganizationMemberRoleDto.MEMBER,
    });

    expect(repository.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        email: "new@example.com",
        role: "MEMBER",
        invitedById: "user-1",
      }),
    );
    expect(repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.invited", organizationId: "org-1" }),
    );
    expect(result.email).toBe("new@example.com");
  });

  it("blocks members from inviting users", async () => {
    await expect(
      service.inviteMember(context({ role: "MEMBER" }), {
        email: "new@example.com",
        role: OrganizationMemberRoleDto.MEMBER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("prevents admins from assigning owner role", async () => {
    await expect(
      service.inviteMember(context({ role: "ADMIN" }), {
        email: "new@example.com",
        role: OrganizationMemberRoleDto.OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("prevents demoting the last owner", async () => {
    repository.findMember.mockResolvedValue(member({ role: "OWNER" }));
    repository.countOwners.mockResolvedValue(1);

    await expect(
      service.updateMemberRole(context(), "member-1", { role: OrganizationMemberRoleDto.ADMIN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prevents removing owners", async () => {
    repository.findMember.mockResolvedValue(member({ role: "OWNER" }));

    await expect(service.removeMember(context(), "member-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("blocks cross-tenant member access by requiring scoped lookup", async () => {
    repository.findMember.mockResolvedValue(null);

    await expect(
      service.updateMemberRole(context(), "other-org-member", {
        role: OrganizationMemberRoleDto.MEMBER,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findMember).toHaveBeenCalledWith("org-1", "other-org-member");
  });
});

function context(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    email: "ada@example.com",
    role: "OWNER",
    ...overrides,
  };
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1",
    organizationId: "org-1",
    role: "MEMBER",
    user: {
      email: "member@example.com",
    },
    ...overrides,
  };
}
