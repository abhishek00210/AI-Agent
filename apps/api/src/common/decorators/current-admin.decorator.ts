import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AdminJwtPayload } from "../../modules/admin/admin.types";

export const CurrentAdmin = createParamDecorator(
  (_: unknown, context: ExecutionContext): AdminJwtPayload => {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { admin?: AdminJwtPayload }>();
    if (!request.admin) throw new Error("Admin principal is not attached to the request.");
    return request.admin;
  },
);
