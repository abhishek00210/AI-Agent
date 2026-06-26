import type { AutomationTriggerType, OutboundCallReason, Prisma } from "../../../generated/prisma";

export interface AutomationTrigger {
  organizationId: string;
  triggerType: AutomationTriggerType;
  customerProfileId?: string;
  contactId?: string;
  sourceEntityType: "Lead" | "Appointment" | "CommunicationMessage" | "CustomerProfile" | "Quote";
  sourceEntityId: string;
  triggerId?: string;
  reasonType?: OutboundCallReason;
  followUpReason: string;
  reasonDescription?: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

export function automationTriggerId(
  input: Pick<
    AutomationTrigger,
    "triggerType" | "sourceEntityType" | "sourceEntityId" | "triggerId"
  >,
) {
  return (
    input.triggerId ?? `${input.triggerType}:${input.sourceEntityType}:${input.sourceEntityId}`
  );
}

export interface AutomationJobData {
  organizationId: string;
  executionId: string;
}

export function outboundReasonForTrigger(triggerType: AutomationTriggerType): OutboundCallReason {
  if (triggerType === "NEW_LEAD") return "LEAD_FOLLOW_UP";
  if (triggerType === "MISSED_APPOINTMENT") return "MISSED_APPOINTMENT";
  if (triggerType === "APPOINTMENT_COMPLETED") return "REVIEW_REQUEST";
  if (triggerType === "NO_RESPONSE") return "REACTIVATION";
  if (triggerType === "QUOTE_SENT") return "QUOTE_FOLLOW_UP";
  if (triggerType === "UPCOMING_APPOINTMENT") return "APPOINTMENT_REMINDER";
  return "MANUAL_CALL";
}

export type AutomationConditions = {
  leadStatuses?: string[];
  appointmentStatuses?: string[];
  customerStatuses?: string[];
  maxPreviousFollowUps?: number;
  lastContactBeforeMinutes?: number;
  noAppointmentBooked?: boolean;
};
