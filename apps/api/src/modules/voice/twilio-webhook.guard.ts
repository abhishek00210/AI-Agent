import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { TwilioSignatureService } from "../twilio/twilio-signature.service";
import { normalizeE164 } from "./e164";
import { CallRepository } from "./repositories/call.repository";
import { PhoneNumberRepository } from "./repositories/phone-number.repository";
import { VoiceWebhookUrlService } from "./voice-webhook-url.service";

@Injectable()
export class TwilioWebhookGuard implements CanActivate {
  private readonly logger = new Logger(TwilioWebhookGuard.name);

  constructor(
    private readonly signatures: TwilioSignatureService,
    private readonly webhookUrls: VoiceWebhookUrlService,
    private readonly phoneNumbers: PhoneNumberRepository,
    private readonly calls: CallRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers["x-twilio-signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    const params = normalizeParams(request.body);
    const valid = this.signatures.validateRequest({
      url: this.webhookUrls.voiceUrl(),
      params,
      signature,
    });

    if (!valid) {
      this.logger.warn("Rejected invalid Twilio webhook signature.");
      await this.auditInvalidWebhook(params);
      throw new ForbiddenException("Invalid Twilio signature.");
    }

    return true;
  }

  private async auditInvalidWebhook(params: Record<string, string | string[] | undefined>) {
    const calledNumber = typeof params.To === "string" ? params.To : null;
    if (!calledNumber) {
      return;
    }
    try {
      const phoneNumber = await this.phoneNumbers.findByPhoneNumber(normalizeE164(calledNumber));
      if (!phoneNumber) {
        return;
      }
      await this.calls.createAuditEvent({
        organizationId: phoneNumber.organizationId,
        action: "call.invalid_webhook",
        entityType: "Call",
        metadata: {
          twilioCallSid: typeof params.CallSid === "string" ? params.CallSid : null,
          calledNumber,
        },
      });
    } catch {
      // Invalid spoofed numbers must not interfere with the 403 response.
    }
  }
}

function normalizeParams(value: unknown): Record<string, string | string[] | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      Array.isArray(entry)
        ? entry.map((item) => String(item))
        : entry === undefined
          ? undefined
          : String(entry),
    ]),
  );
}
