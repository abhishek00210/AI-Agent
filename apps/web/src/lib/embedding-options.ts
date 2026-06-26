import type { ProcessingStatus, WebsiteSourceStatus } from "@ai-agent-platform/types";
import { formatProcessingStatus } from "@/lib/knowledge-base-options";
import { formatWebsiteSourceStatus } from "@/lib/website-source-options";

export type EmbeddingDisplayStatus = ProcessingStatus | WebsiteSourceStatus;

export function formatEmbeddingStatus(status: EmbeddingDisplayStatus): string {
  if (status === "SCRAPING") {
    return "Processing";
  }

  if (["PENDING", "PROCESSING", "EMBEDDING", "COMPLETED", "FAILED"].includes(status)) {
    return formatProcessingStatus(status as ProcessingStatus);
  }

  return formatWebsiteSourceStatus(status as WebsiteSourceStatus);
}

export function embeddingStatusTone(status: EmbeddingDisplayStatus): string {
  if (status === "COMPLETED") {
    return "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900";
  }

  if (status === "FAILED") {
    return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900";
  }

  if (status === "PROCESSING" || status === "EMBEDDING" || status === "SCRAPING") {
    return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900";
}
