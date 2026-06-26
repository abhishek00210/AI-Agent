import type { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows requests when no role metadata exists", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithRole("MEMBER") as never)).toBe(true);
  });

  it("allows users with a required role", () => {
    reflector.getAllAndOverride.mockReturnValue(["OWNER", "ADMIN"]);
    expect(guard.canActivate(contextWithRole("ADMIN") as never)).toBe(true);
  });

  it("blocks users without a required role", () => {
    reflector.getAllAndOverride.mockReturnValue(["OWNER"]);
    expect(guard.canActivate(contextWithRole("MEMBER") as never)).toBe(false);
  });
});

function contextWithRole(role: "OWNER" | "ADMIN" | "MEMBER") {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          role,
        },
      }),
    }),
  };
}
