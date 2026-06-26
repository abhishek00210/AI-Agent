import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  const prisma = {
    $transaction: jest.fn(),
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      update: jest.fn(),
    },
    user: { update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
  };
  const passwords = { verify: jest.fn(), hash: jest.fn() };
  const jwt = { signAsync: jest.fn() };
  const config = {
    getOrThrow: jest.fn((key: string) => (key.includes("Secret") ? "secret" : "15m")),
  };
  const audit = { log: jest.fn() };
  const billing = {
    adminChangePlan: jest.fn(),
    adminCancel: jest.fn(),
    adminResume: jest.fn(),
  };
  const externalNumbers = { adminDisable: jest.fn(), adminAssign: jest.fn() };
  const portRequests = {
    adminList: jest.fn(),
    adminGet: jest.fn(),
    adminUpdate: jest.fn(),
    loaDownload: jest.fn(),
  };
  const locales = {
    defaults: jest.fn(),
    invalidate: jest.fn(),
  };
  const service = new AdminService(
    prisma as never,
    passwords as never,
    jwt as never,
    config as never,
    audit as never,
    billing as never,
    externalNumbers as never,
    portRequests as never,
    locales as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
  });

  it("logs in active super admins and writes an audit log", async () => {
    prisma.adminUser.findUnique.mockResolvedValue(adminFixture());
    passwords.verify.mockResolvedValue(true);
    prisma.adminUser.update.mockResolvedValue(adminFixture());
    jwt.signAsync.mockResolvedValue("admin-token");

    const result = await service.login(
      { email: "ADMIN@EXAMPLE.COM", password: "very-secret-password" },
      "127.0.0.1",
    );

    expect(result.accessToken).toBe("admin-token");
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ adminUserId: "admin-1", tokenUse: "admin", role: "SUPER_ADMIN" }),
      expect.any(Object),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.login",
        resourceType: "AdminUser",
        resourceId: "admin-1",
        ipAddress: "127.0.0.1",
      }),
    );
  });

  it("rejects suspended admin accounts", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({ ...adminFixture(), status: "SUSPENDED" });

    await expect(
      service.login({ email: "admin@example.com", password: "very-secret-password" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects invalid admin passwords", async () => {
    prisma.adminUser.findUnique.mockResolvedValue(adminFixture());
    passwords.verify.mockResolvedValue(false);

    await expect(
      service.login({ email: "admin@example.com", password: "very-secret-password" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("audits organization suspension", async () => {
    prisma.organization.update.mockResolvedValue({ id: "org-1", status: "SUSPENDED" });

    await service.setOrganizationStatus(
      adminPayload(),
      "org-1",
      { status: "SUSPENDED", reason: "fraud review" },
      "127.0.0.1",
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        admin: adminPayload(),
        action: "admin.organization.status_changed",
        resourceType: "Organization",
        resourceId: "org-1",
        metadata: { status: "SUSPENDED", reason: "fraud review" },
      }),
    );
  });
});

function adminFixture() {
  return {
    id: "admin-1",
    email: "admin@example.com",
    firstName: "Super",
    lastName: "Admin",
    role: "SUPER_ADMIN" as const,
    status: "ACTIVE",
    passwordHash: "hash",
  };
}

function adminPayload() {
  return {
    adminUserId: "admin-1",
    email: "admin@example.com",
    role: "SUPER_ADMIN" as const,
    tokenUse: "admin" as const,
  };
}
