import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface TwilioSignatureValidationInput {
  url: string;
  params: Record<string, string | string[] | undefined>;
  signature?: string | null;
}

@Injectable()
export class TwilioSignatureService {
  constructor(private readonly config: ConfigService) {}

  validateRequest(input: TwilioSignatureValidationInput): boolean {
    if (!input.signature || !this.authToken) {
      return false;
    }

    const expected = this.computeSignature(input.url, input.params);
    const received = Buffer.from(input.signature);
    const calculated = Buffer.from(expected);

    if (received.length !== calculated.length) {
      return false;
    }

    return timingSafeEqual(received, calculated);
  }

  private computeSignature(url: string, params: Record<string, string | string[] | undefined>) {
    const payload = Object.keys(params)
      .sort()
      .reduce((accumulator, key) => {
        const value = params[key];
        if (value === undefined) {
          return accumulator;
        }
        const normalizedValue = Array.isArray(value) ? value.join("") : value;
        return `${accumulator}${key}${normalizedValue}`;
      }, url);

    return createHmac("sha1", this.authToken).update(payload).digest("base64");
  }

  private get authToken(): string {
    return this.config.get<string>("twilio.authToken") ?? "";
  }
}
