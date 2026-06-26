import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        "jwt.accessSecret": "test-access-secret",
        "jwt.refreshSecret": "test-refresh-secret",
        "jwt.accessExpiresIn": "15m",
        "jwt.refreshExpiresIn": "30d",
      };
      return values[key];
    }),
  };
  const jwt = {
    signAsync: jest.fn(async () => "signed-access-token"),
  };
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createWithDefaultOrganization: jest.fn(),
  };
  const tokens = {
    createRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    createPasswordResetToken: jest.fn(),
    findPasswordResetToken: jest.fn(),
    consumePasswordResetToken: jest.fn(),
  };
  const mail = {
    sendPasswordResetEmail: jest.fn(),
  };
  const passwords = {
    hash: jest.fn(async (value: string) => `hashed:${value}`),
    verify: jest.fn(async (value: string, hash: string) => hash === `hashed:${value}`),
    generateSecureToken: jest.fn(() => "secure-token"),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    passwords.hash.mockImplementation(async (value: string) => `hashed:${value}`);
    passwords.verify.mockImplementation(
      async (value: string, hash: string) => hash === `hashed:${value}`,
    );
    passwords.generateSecureToken.mockReturnValue("secure-token");
    service = new AuthService(
      jwt as never,
      config as never,
      users as never,
      tokens as never,
      passwords as never,
      mail as never,
    );
  });

  it("registers a user, creates an organization, and returns tokens", async () => {
    users.findByEmail.mockResolvedValue(null);
    users.createWithDefaultOrganization.mockResolvedValue({
      user: user(),
      organization: { id: "org-1" },
    });
    tokens.createRefreshToken.mockResolvedValue({ id: "refresh-1" });

    const result = await service.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@example.com",
      organizationName: "Analytical Engines Inc.",
      industry: "Technology",
      companySize: "2-10",
      country: "CA",
      password: "password123",
    });

    expect(users.createWithDefaultOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        country: "CA",
        organizationName: "Analytical Engines Inc.",
        industry: "Technology",
      }),
    );
    expect(result.accessToken).toBe("signed-access-token");
    expect(result.refreshToken).toMatch(/^refresh-1\./);
    expect(result.user.organizationId).toBe("org-1");
    expect(result.user.role).toBe("OWNER");
  });

  it("rejects duplicate registration emails", async () => {
    users.findByEmail.mockResolvedValue(user());

    await expect(
      service.register({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        organizationName: "Analytical Engines Inc.",
        industry: "Technology",
        country: "CA",
        password: "password123",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in a user with valid credentials", async () => {
    const passwordHash = await passwords.hash("password123");
    users.findByEmail.mockResolvedValue(user({ passwordHash }));
    users.findById.mockResolvedValue(userWithMembership());
    tokens.createRefreshToken.mockResolvedValue({ id: "refresh-1" });

    const result = await service.login({
      email: "ada@example.com",
      password: "password123",
    });

    expect(result.user.email).toBe("ada@example.com");
    expect(result.refreshToken).toMatch(/^refresh-1\./);
  });

  it("uses a generic error for invalid login credentials", async () => {
    const passwordHash = await passwords.hash("password123");
    users.findByEmail.mockResolvedValue(user({ passwordHash }));

    await expect(
      service.login({
        email: "ada@example.com",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rotates refresh tokens", async () => {
    users.findByEmail.mockResolvedValue(null);
    users.createWithDefaultOrganization.mockResolvedValue({
      user: user(),
      organization: { id: "org-1" },
    });
    tokens.createRefreshToken.mockResolvedValue({ id: "refresh-1" });
    const issued = await service.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      organizationName: "Analytical Engines Inc.",
      industry: "Technology",
      country: "CA",
      password: "password123",
    });
    const tokenHash = tokens.createRefreshToken.mock.calls[0][0].tokenHash as string;

    tokens.findRefreshToken.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tokenHash,
      expiresAt: futureDate(),
      revokedAt: null,
      user: userWithMembership(),
    });
    tokens.rotateRefreshToken.mockResolvedValue({ id: "refresh-2" });

    const result = await service.refresh({ refreshToken: issued.refreshToken });

    expect(tokens.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ oldTokenId: "refresh-1", userId: "user-1" }),
    );
    expect(result.refreshToken).toMatch(/^refresh-2\./);
  });

  it("invalidates refresh tokens on logout", async () => {
    await service.logout({ refreshToken: "refresh-1.secret" });
    expect(tokens.revokeRefreshToken).toHaveBeenCalledWith("refresh-1");
  });

  it("generates forgot password tokens without leaking unknown accounts", async () => {
    users.findByEmail.mockResolvedValueOnce(null);

    await expect(service.forgotPassword({ email: "missing@example.com" })).resolves.toEqual({
      success: true,
    });

    users.findByEmail.mockResolvedValueOnce(user());
    tokens.createPasswordResetToken.mockResolvedValue({ id: "reset-1" });

    await service.forgotPassword({ email: "ada@example.com" });

    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com" }),
    );
  });

  it("resets passwords with a valid reset token", async () => {
    tokens.createPasswordResetToken.mockResolvedValue({ id: "reset-1" });
    users.findByEmail.mockResolvedValue(user());
    await service.forgotPassword({ email: "ada@example.com" });
    const tokenHash = tokens.createPasswordResetToken.mock.calls[0][0].tokenHash as string;
    const resetToken = mail.sendPasswordResetEmail.mock.calls[0][0].resetToken as string;

    tokens.findPasswordResetToken.mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      tokenHash,
      expiresAt: futureDate(),
      usedAt: null,
      user: user(),
    });

    await expect(
      service.resetPassword({ token: resetToken, newPassword: "newPassword123" }),
    ).resolves.toEqual({ success: true });
    expect(tokens.consumePasswordResetToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: "reset-1", userId: "user-1" }),
    );
  });

  it("rejects expired reset tokens", async () => {
    tokens.findPasswordResetToken.mockResolvedValue({
      id: "reset-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      user: user(),
    });

    await expect(
      service.resetPassword({ token: "reset-1.secret", newPassword: "newPassword123" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    passwordHash: "hash",
    deletedAt: null,
    ...overrides,
  };
}

function userWithMembership(overrides: Record<string, unknown> = {}) {
  return {
    ...user(),
    memberships: [{ organizationId: "org-1", role: "OWNER" }],
    ...overrides,
  };
}

function futureDate() {
  return new Date(Date.now() + 60_000);
}
