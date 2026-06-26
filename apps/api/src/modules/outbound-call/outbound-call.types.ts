import type {
  OutboundCallReason,
  OutboundCallReasonType,
  OutboundCallStatus,
} from "../../../generated/prisma";

export const OUTBOUND_CALL_TERMINAL_STATUSES: OutboundCallStatus[] = [
  "COMPLETED",
  "FAILED",
  "BUSY",
  "NO_ANSWER",
  "VOICEMAIL",
  "CANCELLED",
];

export function outboundReasonType(value: OutboundCallReason): OutboundCallReasonType {
  if (value === "APPOINTMENT_REMINDER") return "MANUAL_CALL";
  return value;
}

export function isTerminalOutboundStatus(status: OutboundCallStatus) {
  return OUTBOUND_CALL_TERMINAL_STATUSES.includes(status);
}

export function isMachineAnswer(answeredBy?: string | null) {
  return Boolean(answeredBy && answeredBy.toLowerCase().startsWith("machine"));
}
