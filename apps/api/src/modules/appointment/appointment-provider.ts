import type { TenantContext } from "../tenant/tenant.service";

export const APPOINTMENT_PROVIDER = Symbol("APPOINTMENT_PROVIDER");

export interface BookAppointmentInput {
  agentId: string;
  contactId?: string | null;
  conversationId?: string | null;
  callId?: string | null;
  title: string;
  description?: string | null;
  status?: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  durationMinutes: number;
  source: "VOICE" | "CHAT" | "WIDGET" | "MANUAL";
  notes?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AppointmentProvider {
  readonly name: string;
  book(context: TenantContext, input: BookAppointmentInput): Promise<BookAppointmentResult>;
}

export interface BookAppointmentResult {
  id: string;
  organizationId: string;
  agentId: string;
  contactId: string | null;
  conversationId: string | null;
  callId: string | null;
  title: string;
  description: string | null;
  status: string;
  timezone: string;
  startTime: Date;
  endTime: Date;
  source: string;
  confirmationNumber: string;
  idempotencyKey: string | null;
  notes: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  agent?: { id: string; name: string; status: string };
  contact?: { id: string; name: string; phone: string | null; email: string | null } | null;
  conversation?: { id: string; status: string; channel: string; source: string } | null;
  call?: { id: string; twilioCallSid: string; callerNumber: string; calledNumber: string } | null;
}
