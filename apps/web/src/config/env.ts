import { z } from "zod";

const defaultAppUrl =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000";
const defaultApiUrl =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:4000";

/**
 * Deployments historically used both the API origin and the versioned API URL.
 * Keep the public configuration canonical so callers can safely append /api/v1
 * without ever producing /api/v1/api/v1.
 */
export function normalizeApiOrigin(value: string): string {
  return value.replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url().transform(normalizeApiOrigin),
});

export const webEnv = webEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? defaultAppUrl,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? defaultApiUrl,
});
