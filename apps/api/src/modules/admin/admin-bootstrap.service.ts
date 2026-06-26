import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { PasswordService } from "../../security/password.service";

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>("superAdmin.email")?.trim().toLowerCase();
    const password = this.config.get<string>("superAdmin.password");
    if (!email || !password) {
      this.logger.warn(
        "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are not configured; skipping bootstrap.",
      );
      return;
    }
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, status: "ACTIVE", role: "SUPER_ADMIN" },
      create: {
        email,
        passwordHash,
        firstName: "Super",
        lastName: "Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });
    this.logger.log("Super admin bootstrap verified.");
  }
}
