import { BadRequestException } from "@nestjs/common";
import type { CountryCode } from "libphonenumber-js";
import { normalizeE164 } from "../voice/e164";

export function normalizeLeadPhone(value?: string | null, countryCode?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return normalizeE164(stripIndianTrunkPrefix(trimmed), defaultCountry(trimmed, countryCode), { strict: true });
}

export function normalizeLeadEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BadRequestException("Email must be a valid email address.");
  }
  return normalized;
}

export function defaultCountry(value: string, countryCode?: string | null): CountryCode {
  const configured = countryCode?.trim().toUpperCase();
  if (configured && ["US", "CA", "GB", "AU", "IN"].includes(configured)) return configured as CountryCode;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return "IN";
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) return "IN";
  return "US";
}

function stripIndianTrunkPrefix(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    return digits.slice(1);
  }
  return value;
}

export function splitContactName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}
