import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PasswordResetEmailInput {
  to: string;
  firstName: string;
  resetToken: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    const appUrl = this.config.getOrThrow<string>("api.appUrl");
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(
      input.resetToken,
    )}`;

    // Replace this logger with an SMTP or provider adapter when mail delivery is configured.
    this.logger.log(
      `Password reset email queued for ${input.to}. Reset link for local development: ${resetUrl}`,
    );
  }
}
