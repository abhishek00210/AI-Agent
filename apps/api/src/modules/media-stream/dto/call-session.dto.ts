import { z } from "zod";

export const listCallSessionsParamsSchema = z.object({
  callId: z.string().uuid(),
});

export type ListCallSessionsParamsDto = z.infer<typeof listCallSessionsParamsSchema>;
