import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class ExotelSignatureService {
  constructor(private readonly config: ConfigService) {}

  validateRequest(input: {
    url: string;
    params?: Record<string, string | string[] | undefined>;
    rawBody?: Buffer | string;
    signature?: string | null;
  }): boolean {
    const signature = input.signature?.trim();
    if (!signature) return false;

    const secret = this.secret;
    if (!secret) return false;

    const candidates = [
      input.rawBody ? hmac(secret, input.rawBody) : null,
      hmac(secret, canonicalParams(input.params ?? {})),
      hmac(secret, `${input.url}${canonicalParams(input.params ?? {})}`),
    ].filter(Boolean) as string[];

    return candidates.some((candidate) => secureCompare(signature, candidate));
  }

  streamToken(): string {
    const secret = this.secret;
    if (!secret) return "";
    return hmac(secret, "exotel-agentstream");
  }

  validateStreamToken(token?: string | null): boolean {
    const expected = this.streamToken();
    return Boolean(expected && token && secureCompare(token, expected));
  }

  private get secret(): string {
    return (
      this.config.get<string>("exotel.webhookSecret") ||
      this.config.get<string>("exotel.apiToken") ||
      ""
    );
  }
}

function hmac(secret: string, payload: Buffer | string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function canonicalParams(params: Record<string, string | string[] | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((entry) => `${key}=${entry}`)
        : [`${key}=${value ?? ""}`],
    )
    .join("&");
}

function secureCompare(left: string, right: string) {
  const normalizedLeft = left.replace(/^sha256=/i, "");
  const normalizedRight = right.replace(/^sha256=/i, "");
  const leftBuffer = Buffer.from(normalizedLeft);
  const rightBuffer = Buffer.from(normalizedRight);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
