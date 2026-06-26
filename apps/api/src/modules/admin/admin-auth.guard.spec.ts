import { UnauthorizedException } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";

describe("AdminAuthGuard", () => {
  const config = { getOrThrow: jest.fn(() => "secret") };
  const jwt = { verifyAsync: jest.fn() };
  const guard = new AdminAuthGuard(jwt as never, config as never);

  beforeEach(() => jest.clearAllMocks());

  it("rejects tenant JWT payloads without admin tokenUse", async () => {
    jwt.verifyAsync.mockResolvedValue({
      userId: "user-1",
      organizationId: "org-1",
      role: "OWNER",
    });

    await expect(guard.canActivate(context("Bearer tenant-token"))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("attaches valid super admin payloads", async () => {
    const payload = {
      adminUserId: "admin-1",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
      tokenUse: "admin",
    };
    jwt.verifyAsync.mockResolvedValue(payload);
    const request = requestWithAuth("Bearer admin-token");

    await expect(guard.canActivate(contextFromRequest(request))).resolves.toBe(true);
    expect(request.admin).toEqual(payload);
  });

  it("rejects missing bearer tokens", async () => {
    await expect(guard.canActivate(context(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

function context(authorization?: string) {
  return contextFromRequest(requestWithAuth(authorization));
}

function requestWithAuth(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as {
    headers: Record<string, string>;
    admin?: unknown;
  };
}

function contextFromRequest(request: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}
