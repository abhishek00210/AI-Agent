import { SetMetadata } from "@nestjs/common";
import type { MemberRole } from "@ai-agent-platform/types";

export const ROLES_KEY = "roles";

export function Roles(...roles: MemberRole[]) {
  return SetMetadata(ROLES_KEY, roles);
}
