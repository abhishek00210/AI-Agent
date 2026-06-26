import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class AuthTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    deviceInfo?: string;
  }) {
    return this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        deviceInfo: input.deviceInfo,
      },
    });
  }

  findRefreshToken(id: string) {
    return this.prisma.refreshToken.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            memberships: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    });
  }

  revokeRefreshToken(id: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    return client.refreshToken.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  rotateRefreshToken(input: {
    oldTokenId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    deviceInfo?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.revokeRefreshToken(input.oldTokenId, tx);
      return tx.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          deviceInfo: input.deviceInfo,
        },
      });
    });
  }

  createPasswordResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    return this.prisma.passwordResetToken.create({
      data: input,
    });
  }

  findPasswordResetToken(id: string) {
    return this.prisma.passwordResetToken.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  consumePasswordResetToken(input: { id: string; userId: string; passwordHash: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: input.id },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: input.userId,
          usedAt: null,
          id: { not: input.id },
        },
        data: { usedAt: new Date() },
      });

      return tx.user.update({
        where: { id: input.userId },
        data: { passwordHash: input.passwordHash },
      });
    });
  }
}
