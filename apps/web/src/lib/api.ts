import { ApiClient } from "@ai-agent-platform/sdk";
import { webEnv } from "@/config/env";

export const apiClient = new ApiClient({
  baseUrl: `${webEnv.NEXT_PUBLIC_API_URL}/api/v1`,
});
