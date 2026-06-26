import type { CustomerLeadStatus, CustomerTimelineEventType, Outcome, Sentiment } from "../../../generated/prisma";

export interface CustomerMemorySummary {
  id: string;
  summary: string;
  intent: string;
  sentiment: Sentiment;
  outcome: Outcome;
  nextAction: string | null;
  followUpRequired: boolean;
  confidenceScore: number;
  generatedAt: Date;
}

export interface CustomerMemoryTimelineEvent {
  id: string;
  eventType: CustomerTimelineEventType;
  title: string;
  description: string | null;
  occurredAt: Date;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
}

export interface CustomerMemoryAppointment {
  id: string;
  title: string;
  status: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
}

export interface CustomerMemoryContext {
  customer: {
    id: string;
    organizationId: string;
    contactId: string;
    name: string | null;
    company: string | null;
    leadStatus: CustomerLeadStatus;
    lastContactAt: Date | null;
    totalCalls: number;
  };
  recognized: boolean;
  recognitionConfidence: "HIGH" | "MEDIUM";
  recentSummaries: CustomerMemorySummary[];
  recentTimeline: CustomerMemoryTimelineEvent[];
  appointments: CustomerMemoryAppointment[];
  openFollowUps: Array<{ summaryId: string; action: string; generatedAt: Date }>;
  promptContext: string;
  estimatedTokens: number;
}

export type GreetingChannel = "VOICE" | "CHAT" | "WIDGET" | "SMS" | "ADMIN";
export type GreetingConfidenceThreshold = "LOW" | "MEDIUM" | "HIGH";
export type GreetingFallbackReason =
  | "UNKNOWN_CUSTOMER"
  | "DISABLED"
  | "LOW_CONFIDENCE"
  | "STALE_CONTEXT"
  | "NO_CONTEXT";

export interface GreetingSettings {
  enabled: boolean;
  recencyWindowDays: number;
  confidenceThreshold: GreetingConfidenceThreshold;
}

export interface GreetingDecision {
  level: 0 | 1 | 2 | 3;
  instructions: string;
  preview: string;
  personalized: boolean;
  fallbackReason?: GreetingFallbackReason;
  context: {
    customerName: string | null;
    lastContactAt: Date | null;
    lastSummary: CustomerMemorySummary | null;
    upcomingAppointment: CustomerMemoryAppointment | null;
    openFollowUp: { summaryId: string; action: string; generatedAt: Date } | null;
    leadStatus: CustomerMemoryContext["customer"]["leadStatus"];
  };
  settings: GreetingSettings;
}

export interface MemoryLoadInput {
  organizationId: string;
  customerProfileId: string;
  interactionId: string;
  excludeCallId?: string;
  channel: "VOICE" | "CHAT" | "WIDGET" | "SMS" | "ADMIN";
  track?: boolean;
}
