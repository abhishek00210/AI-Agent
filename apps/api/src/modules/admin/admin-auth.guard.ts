import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import type { AdminJwtPayload } from "./admin.types";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { admin?: AdminJwtPayload }>();
    const rawHeader = request.headers.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Missing admin bearer token.");

    try {
      const payload = await this.jwtService.verifyAsync<AdminJwtPayload>(token, {
        secret: this.config.getOrThrow<string>("jwt.accessSecret"),
      });
      if (payload.tokenUse !== "admin" || payload.role !== "SUPER_ADMIN" || !payload.adminUserId) {
        throw new UnauthorizedException("Invalid admin token.");
      }
      request.admin = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired admin token.");
    }
  }
}
