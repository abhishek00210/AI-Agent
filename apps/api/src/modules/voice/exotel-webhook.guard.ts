import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ExotelSignatureService } from "../telephony/exotel-signature.service";
import { VoiceWebhookUrlService } from "./voice-webhook-url.service";

@Injectable()
export class ExotelWebhookGuard implements CanActivate {
  private readonly logger = new Logger(ExotelWebhookGuard.name);

  constructor(
    private readonly signatures: ExotelSignatureService,
    private readonly webhookUrls: VoiceWebhookUrlService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest & { rawBody?: Buffer }>();
    const valid = this.signatures.validateRequest({
      url: this.webhookUrls.voiceUrl("EXOTEL"),
      params: normalizeParams(request.body),
      rawBody: request.rawBody,
      signature: signatureHeader(request),
    });
    if (!valid) {
      this.logger.warn("Rejected invalid Exotel webhook signature.");
      throw new ForbiddenException("Invalid Exotel signature.");
    }
    return true;
  }
}

export function signatureHeader(request: FastifyRequest) {
  for (const key of ["x-exotel-signature", "x-exotel-webhook-signature", "x-exotel-signature-sha256"]) {
    const header = request.headers[key];
    const value = Array.isArray(header) ? header[0] : header;
    if (value) return value;
  }
  return undefined;
}

export function normalizeParams(value: unknown): Record<string, string | string[] | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
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
