import { BadRequestException } from "@nestjs/common";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function normalizeE164(value: string, defaultCountry: CountryCode = "US", options: { strict?: boolean } = {}): string {
  const trimmed = value.trim();
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  const normalized = parsed?.number ?? fallbackE164(trimmed);

  if (!normalized || !/^\+[1-9]\d{7,14}$/.test(normalized) || (options.strict && !parsed?.isValid())) {
    throw new BadRequestException("Phone number must be valid and convertible to E.164 format.");
  }
  return normalized;
}

function fallbackE164(value: string) {
  if (value.trim().startsWith("+")) return `+${value.trim().slice(1).replace(/\D/g, "")}`;
  return null;
}
