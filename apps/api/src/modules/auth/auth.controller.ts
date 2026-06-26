import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { BruteForceService } from "./brute-force.service";
import type { JwtPayload } from "./auth.types";
import {
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly bruteForce: BruteForceService,
  ) {}

  @Post("register")
  register(@Body() body: RegisterDto, @Req() request: FastifyRequest) {
    return this.authService.register(body, this.deviceInfo(request));
  }

  @Post("login")
  async login(@Body() body: LoginDto, @Req() request: FastifyRequest) {
    const key = this.bruteForceKey(body.email, request);
    await this.bruteForce.assertAllowed(key);

    try {
      const response = await this.authService.login(body, this.deviceInfo(request));
      await this.bruteForce.clear(key);
      return response;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.bruteForce.recordFailure(key);
      }

      throw error;
    }
  }

  @Post("refresh")
  refresh(@Body() body: RefreshTokenDto, @Req() request: FastifyRequest) {
    return this.authService.refresh(body, this.deviceInfo(request));
  }

  @Post("logout")
  logout(@Body() body: LogoutDto) {
    return this.authService.logout(body);
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return { user };
  }

  private bruteForceKey(email: string, request: FastifyRequest): string {
    return `${email.trim().toLowerCase()}:${request.ip ?? "unknown"}`;
  }

  private deviceInfo(request: FastifyRequest): string | undefined {
    return request.headers["user-agent"];
  }
}
