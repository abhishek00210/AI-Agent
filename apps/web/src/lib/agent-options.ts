import type { AgentStatus } from "@ai-agent-platform/types";

export const agentLanguages = [
  { label: "English", value: "en-US" },
  { label: "Hindi", value: "hi-IN" },
  { label: "Spanish", value: "es-ES" },
  { label: "French", value: "fr-FR" },
  { label: "German", value: "de-DE" },
  { label: "Arabic", value: "ar-SA" },
];

export const agentVoices = [
  { label: "Alloy", value: "alloy" },
  { label: "Echo", value: "echo" },
  { label: "Fable", value: "fable" },
  { label: "Onyx", value: "onyx" },
  { label: "Nova", value: "nova" },
  { label: "Shimmer", value: "shimmer" },
];

export const agentStatuses: Array<{ label: string; value: AgentStatus }> = [
  { label: "Draft", value: "DRAFT" },
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

export function formatAgentStatus(status: AgentStatus) {
  return agentStatuses.find((item) => item.value === status)?.label ?? status;
}

export function formatAgentLanguage(language: string) {
  return agentLanguages.find((item) => item.value === language)?.label ?? language;
}

export function formatAgentVoice(voice: string) {
  return agentVoices.find((item) => item.value === voice)?.label ?? voice;
}
