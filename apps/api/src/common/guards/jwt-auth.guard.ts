import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../../modules/auth/auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: unknown }>();
    const rawHeader = request.headers.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload & { tokenUse?: string }>(token, {
        secret: this.config.getOrThrow<string>("jwt.accessSecret"),
      });
      if (
        payload.tokenUse === "admin" ||
        !payload.userId ||
        !payload.organizationId ||
        !payload.email ||
        !["OWNER", "ADMIN", "MEMBER"].includes(payload.role)
      ) {
        throw new UnauthorizedException("Invalid tenant token");
      }
      const membership = await this.prisma.organizationMember.findFirst({
        where: {
          userId: payload.userId,
          organizationId: payload.organizationId,
          role: payload.role,
          deletedAt: null,
          user: { status: "ACTIVE", deletedAt: null },
          organization: {
            status: { in: ["ACTIVE", "TRIAL_EXPIRED"] },
            deletedAt: null,
          },
        },
        select: { id: true },
      });
      if (!membership) throw new UnauthorizedException("Tenant access is disabled");
      request.user = payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    return true;
  }
}
