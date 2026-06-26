import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  const jwt = {
    verifyAsync: jest.fn(),
  };
  const config = {
    getOrThrow: jest.fn(() => "access-secret"),
  };
  const prisma = {
    organizationMember: { findFirst: jest.fn() },
  };
  const guard = new JwtAuthGuard(jwt as never, config as never, prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findFirst.mockResolvedValue({ id: "member-1" });
  });

  it("attaches verified JWT payloads to the request", async () => {
    jwt.verifyAsync.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      email: "ada@example.com",
      role: "OWNER",
    });
    const request = requestWithAuth("Bearer token");

    await expect(guard.canActivate(contextFor(request) as never)).resolves.toBe(true);
    expect(request.user).toEqual(expect.objectContaining({ userId: "user-1" }));
  });

  it("rejects missing bearer tokens", async () => {
    await expect(guard.canActivate(contextFor(requestWithAuth()) as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects expired or invalid tokens as unauthorized", async () => {
    jwt.verifyAsync.mockRejectedValue(new Error("jwt expired"));

    await expect(
      guard.canActivate(contextFor(requestWithAuth("Bearer expired-token")) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects super admin tokens on tenant APIs", async () => {
    jwt.verifyAsync.mockResolvedValue({
      adminUserId: "admin-1",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
      tokenUse: "admin",
    });

    await expect(
      guard.canActivate(contextFor(requestWithAuth("Bearer admin-token")) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects suspended users or organizations", async () => {
    jwt.verifyAsync.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      email: "ada@example.com",
      role: "OWNER",
    });
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor(requestWithAuth("Bearer tenant-token")) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function requestWithAuth(authorization?: string) {
  return {
    user: undefined,
    headers: authorization ? { authorization } : {},
  };
}

function contextFor(request: ReturnType<typeof requestWithAuth>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}
