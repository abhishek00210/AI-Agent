import type { Prisma } from "../../../generated/prisma";

export type AnalyticsEventType =
  | "CALL_STARTED"
  | "CALL_DURATION"
  | "LEAD_CREATED"
  | "APPOINTMENT_CREATED"
  | "SMS_SENT"
  | "AI_RESPONSE"
  | "AI_SUMMARY_GENERATED"
  | "CALLER_RECOGNIZED"
  | "MEMORY_CONTEXT_LOADED"
  | "PERSONALIZED_GREETING"
  | "GREETING_GENERATED"
  | "TOOL_EXECUTION"
  | "BILLING_PAYMENT"
  | "SUBSCRIPTION_UPDATED"
  | "AUTOMATION_TRIGGERED"
  | "AUTOMATION_COMPLETED"
  | "AUTOMATION_FAILED"
  | "WORKFLOW_TEMPLATE_ACTIVATED"
  | "OUTBOUND_CALL_STARTED"
  | "OUTBOUND_CALL_COMPLETED"
  | "CAMPAIGN_CALL_CREATED"
  | "SIGNUP_STARTED"
  | "ORGANIZATION_CREATED"
  | "SIGNUP_COMPLETED";

export interface AnalyticsEventInput {
  organizationId: string;
  eventType: AnalyticsEventType;
  idempotencyKey: string;
  agentId?: string;
  agentName?: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

export interface AnalyticsRange {
  from: Date;
  to: Date;
}
