import { z } from "zod";

export const requiredUrlSchema = z.string().url();

export const nonEmptyString = z.string().trim().min(1);

export const emailSchema = z.string().trim().email().toLowerCase();

export const passwordSchema = z.string().min(12).max(128);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function parseEnv<T extends z.ZodTypeAny>(schema: T, env: unknown): z.infer<T> {
  return schema.parse(env);
}

export function isProduction(nodeEnv: string | undefined): boolean {
  return nodeEnv === "production";
}
