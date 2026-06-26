import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MailService } from "../mail/mail.service";
import { UserRepository } from "../user/repositories/user.repository";
import { PasswordService } from "../../security/password.service";
import { AuthTokenRepository } from "./repositories/auth-token.repository";
import type { AuthResponse, AuthUserResponse, JwtPayload } from "./auth.types";
import type {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

interface TokenParts {
  id: string;
  secret: string;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtl = 15 * 60 * 1000;
  private readonly refreshTokenTtl = 30 * 24 * 60 * 60 * 1000;
  private readonly resetTokenTtl = 60 * 60 * 1000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly users: UserRepository,
    private readonly tokens: AuthTokenRepository,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterDto, deviceInfo?: string): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    const passwordHash = await this.passwords.hash(input.password);
    const { user, organization } = await this.users.createWithDefaultOrganization({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      passwordHash,
      country: input.country,
      organizationName: input.organizationName.trim(),
      industry: input.industry.trim(),
      companySize: input.companySize?.trim(),
    });

    return this.createAuthResponse(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: organization.id,
        role: "OWNER",
      },
      deviceInfo,
    );
  }

  async login(input: LoginDto, deviceInfo?: string): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    const invalidLogin = new UnauthorizedException("Invalid email or password.");

    if (!user) {
      throw invalidLogin;
    }

    const validPassword = await this.passwords.verify(input.password, user.passwordHash);

    if (!validPassword) {
      throw invalidLogin;
    }

    const userWithMembership = await this.users.findById(user.id);
    const membership = userWithMembership?.memberships[0];

    if (!membership) {
      throw new UnauthorizedException("User is not assigned to an organization.");
    }

    return this.createAuthResponse(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: membership.organizationId,
        role: membership.role,
      },
      deviceInfo,
    );
  }

  async refresh(input: RefreshTokenDto, deviceInfo?: string): Promise<AuthResponse> {
    const tokenParts = this.parseOpaqueToken(input.refreshToken);
    const storedToken = await this.tokens.findRefreshToken(tokenParts.id);

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt.getTime() <= Date.now() ||
      storedToken.user.deletedAt
    ) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const validToken = await this.passwords.verify(tokenParts.secret, storedToken.tokenHash);

    if (!validToken) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const membership = storedToken.user.memberships[0];

    if (!membership) {
      throw new UnauthorizedException("User is not assigned to an organization.");
    }

    const refreshToken = await this.rotateRefreshToken(
      storedToken.id,
      storedToken.userId,
      deviceInfo,
    );
    const user = {
      id: storedToken.user.id,
      email: storedToken.user.email,
      firstName: storedToken.user.firstName,
      lastName: storedToken.user.lastName,
      organizationId: membership.organizationId,
      role: membership.role,
    };

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      user,
    };
  }

  async logout(input: RefreshTokenDto): Promise<{ success: true }> {
    const tokenParts = this.parseOpaqueToken(input.refreshToken);
    await this.tokens.revokeRefreshToken(tokenParts.id);
    return { success: true };
  }

  async forgotPassword(input: ForgotPasswordDto): Promise<{ success: true }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (!user) {
      return { success: true };
    }

    const resetToken = await this.createPasswordResetToken(user.id);
    await this.mail.sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetToken,
    });

    return { success: true };
  }

  async resetPassword(input: ResetPasswordDto): Promise<{ success: true }> {
    const tokenParts = this.parseOpaqueToken(input.token);
    const storedToken = await this.tokens.findPasswordResetToken(tokenParts.id);

    if (
      !storedToken ||
      storedToken.usedAt ||
      storedToken.expiresAt.getTime() <= Date.now() ||
      storedToken.user.deletedAt
    ) {
      throw new BadRequestException("Invalid or expired reset token.");
    }

    const validToken = await this.passwords.verify(tokenParts.secret, storedToken.tokenHash);

    if (!validToken) {
      throw new BadRequestException("Invalid or expired reset token.");
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.tokens.consumePasswordResetToken({
      id: storedToken.id,
      userId: storedToken.userId,
      passwordHash,
    });

    return { success: true };
  }

  private async createAuthResponse(
    user: AuthUserResponse,
    deviceInfo?: string,
  ): Promise<AuthResponse> {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.createRefreshToken(user.id, deviceInfo),
      user,
    };
  }

  private async signAccessToken(user: AuthUserResponse): Promise<string> {
    const payload: JwtPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>("jwt.accessSecret"),
      expiresIn: this.config.getOrThrow<string>("jwt.accessExpiresIn") as never,
    });
  }

  private async createRefreshToken(userId: string, deviceInfo?: string): Promise<string> {
    const secret = this.passwords.generateSecureToken();
    const tokenHash = await this.passwords.hash(secret);
    const storedToken = await this.tokens.createRefreshToken({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + this.refreshTokenTtl),
      deviceInfo,
    });

    return this.formatOpaqueToken(storedToken.id, secret);
  }

  private async rotateRefreshToken(
    oldTokenId: string,
    userId: string,
    deviceInfo?: string,
  ): Promise<string> {
    const secret = this.passwords.generateSecureToken();
    const tokenHash = await this.passwords.hash(secret);
    const storedToken = await this.tokens.rotateRefreshToken({
      oldTokenId,
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + this.refreshTokenTtl),
      deviceInfo,
    });

    return this.formatOpaqueToken(storedToken.id, secret);
  }

  private async createPasswordResetToken(userId: string): Promise<string> {
    const secret = this.passwords.generateSecureToken();
    const tokenHash = await this.passwords.hash(secret);
    const storedToken = await this.tokens.createPasswordResetToken({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + this.resetTokenTtl),
    });

    return this.formatOpaqueToken(storedToken.id, secret);
  }

  private formatOpaqueToken(id: string, secret: string): string {
    return `${id}.${secret}`;
  }

  private parseOpaqueToken(token: string): TokenParts {
    const [id, secret] = token.split(".");

    if (!id || !secret) {
      throw new UnauthorizedException("Invalid token.");
    }

    return { id, secret };
  }
}
