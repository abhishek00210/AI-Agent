import type { KnowledgeBaseStatus, ProcessingStatus, UploadStatus } from "@ai-agent-platform/types";

export const knowledgeBaseStatuses: Array<{ label: string; value: KnowledgeBaseStatus }> = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

export const uploadStatuses: Array<{ label: string; value: UploadStatus }> = [
  { label: "Pending", value: "PENDING" },
  { label: "Uploaded", value: "UPLOADED" },
  { label: "Failed", value: "FAILED" },
];

export const processingStatuses: Array<{ label: string; value: ProcessingStatus }> = [
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Embedding", value: "EMBEDDING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
];

export function formatKnowledgeBaseStatus(status: KnowledgeBaseStatus): string {
  return knowledgeBaseStatuses.find((item) => item.value === status)?.label ?? status;
}

export function formatUploadStatus(status: UploadStatus): string {
  return uploadStatuses.find((item) => item.value === status)?.label ?? status;
}

export function formatProcessingStatus(status: ProcessingStatus): string {
  return processingStatuses.find((item) => item.value === status)?.label ?? status;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return "No file";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatUploader(
  uploadedBy?: { firstName: string; lastName: string; email: string } | null,
): string {
  if (!uploadedBy) {
    return "Not uploaded";
  }

  const fullName = `${uploadedBy.firstName} ${uploadedBy.lastName}`.trim();
  return fullName || uploadedBy.email;
}
