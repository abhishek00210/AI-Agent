import type { ConversationChannel, ConversationStatus, SenderType } from "@ai-agent-platform/types";

export const conversationStatuses: Array<{ label: string; value: ConversationStatus }> = [
  { label: "Active", value: "ACTIVE" },
  { label: "Closed", value: "CLOSED" },
  { label: "Archived", value: "ARCHIVED" },
];

export const conversationChannels: Array<{ label: string; value: ConversationChannel }> = [
  { label: "Web Chat", value: "WEB_CHAT" },
  { label: "Voice", value: "VOICE" },
  { label: "SMS", value: "SMS" },
  { label: "WhatsApp", value: "WHATSAPP" },
];

export function formatConversationStatus(status: ConversationStatus): string {
  return conversationStatuses.find((item) => item.value === status)?.label ?? status;
}

export function formatConversationChannel(channel: ConversationChannel): string {
  return conversationChannels.find((item) => item.value === channel)?.label ?? channel;
}

export function formatSender(senderType: SenderType): string {
  const labels: Record<SenderType, string> = {
    USER: "User",
    ASSISTANT: "Assistant",
    SYSTEM: "System",
  };
  return labels[senderType];
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
