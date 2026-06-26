import type { WebsiteSourceStatus } from "@ai-agent-platform/types";

export const websiteSourceStatuses: Array<{ label: string; value: WebsiteSourceStatus }> = [
  { label: "Pending", value: "PENDING" },
  { label: "Scraping", value: "SCRAPING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
];

export function formatWebsiteSourceStatus(status: WebsiteSourceStatus): string {
  return websiteSourceStatuses.find((item) => item.value === status)?.label ?? status;
}

export function websiteSourceStatusTone(status: WebsiteSourceStatus): string {
  const tones: Record<WebsiteSourceStatus, string> = {
    PENDING:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    SCRAPING:
      "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
    COMPLETED:
      "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900",
    FAILED:
      "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
  };

  return tones[status];
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

export function formatUrlHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "Invalid URL";
  }
}
