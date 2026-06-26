import { ForbiddenException, Injectable } from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.types";

export interface TenantContext {
  userId: string;
  organizationId: string;
  email: string;
  role: JwtPayload["role"];
}

@Injectable()
export class TenantService {
  fromUser(user: JwtPayload): TenantContext {
    if (!user.organizationId) {
      throw new ForbiddenException("Tenant context is missing.");
    }

    return {
      userId: user.userId,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    };
  }

  assertSameOrganization(resourceOrganizationId: string, context: TenantContext): void {
    if (resourceOrganizationId !== context.organizationId) {
      throw new ForbiddenException("Resource does not belong to the current organization.");
    }
  }

  scope<T extends Record<string, unknown>>(
    context: TenantContext,
    where: T,
  ): T & { organizationId: string } {
    return {
      ...where,
      organizationId: context.organizationId,
    };
  }
}
