import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TwilioPortingService {
  constructor(private readonly config: ConfigService) {}

  automationEnabled() {
    return this.config.get<string>("TWILIO_PORTING_AUTOMATION_ENABLED") === "true";
  }

  async submit() {
    // Twilio porting availability and required fields vary by account and country.
    // Requests deliberately enter the audited admin-review queue until explicitly enabled.
    return { automated: false as const, providerRequestId: null };
  }
}

