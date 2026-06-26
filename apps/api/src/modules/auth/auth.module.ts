import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SecurityModule } from "../../security/security.module";
import { MailModule } from "../mail/mail.module";
import { UserModule } from "../user/user.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { BruteForceService } from "./brute-force.service";
import { AuthTokenRepository } from "./repositories/auth-token.repository";

@Module({
  imports: [
    SecurityModule,
    UserModule,
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("jwt.accessSecret"),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenRepository, BruteForceService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
