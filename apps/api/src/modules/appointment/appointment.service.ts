import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AppointmentStatus, Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import type { TenantContext } from "../tenant/tenant.service";
import { addMinutes, localDateTimeToUtc } from "./appointment-time";
import {
  APPOINTMENT_PROVIDER,
  type AppointmentProvider,
  type BookAppointmentInput,
} from "./appointment-provider";
import { BookingValidator } from "./booking-validator";
import { appointmentSuccessMessage } from "./local-appointment.provider";
import type {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from "./dto/appointment.dto";
import { AppointmentRepository } from "./repositories/appointment.repository";
import { CommunicationService } from "../communication/communication.service";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerResolverService } from "../customer/customer-resolver.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { AutomationEngineService } from "../automation/automation-engine.service";

@Injectable()
export class AppointmentService {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly validator: BookingValidator,
    @Inject(APPOINTMENT_PROVIDER)
    private readonly appointmentProvider: AppointmentProvider,
    private readonly prisma: PrismaService,
    private readonly communications: CommunicationService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly customers?: CustomerResolverService,
    @Optional() private readonly customerTimeline?: CustomerTimelineService,
    @Optional() private readonly automations?: AutomationEngineService,
  ) {}

  async list(context: TenantContext, query: ListAppointmentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.appointments.list({
      organizationId: context.organizationId,
      page,
      limit,
      search: normalizeOptionalText(query.search) ?? undefined,
      status: query.status as AppointmentStatus | undefined,
      agentId: query.agentId,
      contactId: query.contactId,
      callId: query.callId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    });
    return {
      total: result.total,
      page,
      limit,
      data: result.data.map(toAppointmentResponse),
    };
  }

  async getById(context: TenantContext, appointmentId: string) {
    const appointment = await this.appointments.findById(context.organizationId, appointmentId);
    if (!appointment) throw new NotFoundException("Appointment not found.");
    return toAppointmentResponse(appointment);
  }

  async create(context: TenantContext, input: CreateAppointmentDto) {
    await this.gates?.assertAppointmentCapacity(context.organizationId);
    const appointment = await this.appointmentProvider.book(context, {
      agentId: input.agentId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      callId: input.callId,
      title: input.title,
      description: input.description,
      status: input.status ?? "CONFIRMED",
      timezone: input.timezone,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      durationMinutes: input.durationMinutes ?? 30,
      source: input.source ?? "MANUAL",
      notes: input.notes,
    });
    await this.audit(context, "appointment.confirmed", appointment.id, {
      confirmationNumber: appointment.confirmationNumber,
      source: appointment.source,
    });
    await this.trackAppointment(context.organizationId, appointment.id);
    await this.trackAppointmentAnalytics(context.organizationId, appointment);
    await this.scheduleNotifications(context, appointment);
    if (appointment.contactId)
      await this.customers?.resolveCustomer({
        organizationId: context.organizationId,
        contactId: appointment.contactId,
        interaction: "APPOINTMENT",
        leadStatus: "BOOKED",
      });
    if (appointment.contactId)
      await this.customerTimeline?.recordEvent({
        organizationId: context.organizationId,
        contactId: appointment.contactId,
        eventType: "APPOINTMENT_BOOKED",
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        idempotencyKey: `appointment:booked:${appointment.id}`,
        description: appointment.title,
        occurredAt: appointment.createdAt,
      });
    if (appointment.contactId)
      await this.automations?.cancelForContact(
        context.organizationId,
        appointment.contactId,
        ["NEW_LEAD", "NO_RESPONSE"],
        "Customer booked an appointment.",
      );
    if (appointment.contactId)
      await this.scheduleUpcomingAppointmentAutomation(context.organizationId, appointment);
    return toAppointmentResponse(appointment);
  }

  async update(context: TenantContext, appointmentId: string, input: UpdateAppointmentDto) {
    const existing = await this.appointments.findById(context.organizationId, appointmentId);
    if (!existing) throw new NotFoundException("Appointment not found.");

    let startTime = existing.startTime;
    let endTime = existing.endTime;
    const timezone = input.timezone ?? existing.timezone;
    if (input.preferredDate || input.preferredTime || input.durationMinutes || input.timezone) {
      const duration =
        input.durationMinutes ??
        Math.max(
          15,
          Math.round((existing.endTime.getTime() - existing.startTime.getTime()) / 60_000),
        );
      startTime = localDateTimeToUtc(
        input.preferredDate ?? existing.startTime.toISOString().slice(0, 10),
        input.preferredTime ?? toUtcTime(existing.startTime),
        timezone,
      );
      endTime = addMinutes(startTime, duration);
    }
    const status = (input.status ?? existing.status) as AppointmentStatus;
    await this.validator.validate({
      context,
      agentId: existing.agentId,
      contactId: existing.contactId,
      conversationId: existing.conversationId,
      callId: existing.callId,
      startTime,
      endTime,
      timezone,
      status,
      excludeAppointmentId: appointmentId,
    });

    const appointment = await this.appointments.update(context.organizationId, appointmentId, {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: normalizeOptionalText(input.description) }
        : {}),
      ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
      ...(input.status !== undefined ? { status } : {}),
      timezone,
      startTime,
      endTime,
    });
    await this.audit(context, "appointment.updated", appointment.id, {
      confirmationNumber: appointment.confirmationNumber,
      status: appointment.status,
    });
    if (appointment.contactId)
      await this.customerTimeline?.recordEvent({
        organizationId: context.organizationId,
        contactId: appointment.contactId,
        eventType: "APPOINTMENT_RESCHEDULED",
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        idempotencyKey: `appointment:rescheduled:${appointment.id}:${appointment.updatedAt.toISOString()}`,
        description: appointment.title,
      });
    if (
      appointment.contactId &&
      (startTime.getTime() !== existing.startTime.getTime() || status !== "NO_SHOW")
    )
      await this.automations?.cancelForContact(
        context.organizationId,
        appointment.contactId,
        ["MISSED_APPOINTMENT"],
        "Appointment was rescheduled or is no longer missed.",
      );
    if (appointment.contactId && startTime.getTime() !== existing.startTime.getTime()) {
      await this.automations?.cancelForContact(
        context.organizationId,
        appointment.contactId,
        ["UPCOMING_APPOINTMENT"],
        "Appointment was rescheduled.",
      );
      await this.scheduleUpcomingAppointmentAutomation(
        context.organizationId,
        appointment,
        appointment.updatedAt.toISOString(),
      );
    }
    if (appointment.contactId && status === "NO_SHOW" && existing.status !== "NO_SHOW")
      await this.automations?.trigger({
        organizationId: context.organizationId,
        triggerType: "MISSED_APPOINTMENT",
        contactId: appointment.contactId,
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        reasonType: "MISSED_APPOINTMENT",
        followUpReason: `Customer missed ${appointment.title} scheduled for ${appointment.startTime.toISOString()}.`,
        reasonDescription: `Customer missed ${appointment.title} scheduled for ${appointment.startTime.toISOString()}.`,
      });
    if (appointment.contactId && status === "COMPLETED" && existing.status !== "COMPLETED")
      await this.automations?.trigger({
        organizationId: context.organizationId,
        triggerType: "APPOINTMENT_COMPLETED",
        contactId: appointment.contactId,
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        reasonType: "REVIEW_REQUEST",
        followUpReason: `${appointment.title} was completed on ${appointment.endTime.toISOString()}; request customer feedback.`,
        reasonDescription: `${appointment.title} was completed on ${appointment.endTime.toISOString()}; request customer feedback.`,
      });
    return toAppointmentResponse(appointment);
  }

  async cancel(context: TenantContext, appointmentId: string) {
    const existing = await this.appointments.findById(context.organizationId, appointmentId);
    if (!existing) throw new NotFoundException("Appointment not found.");
    const appointment = await this.appointments.cancel(context.organizationId, appointmentId);
    await this.audit(context, "appointment.cancelled", appointment.id, {
      confirmationNumber: appointment.confirmationNumber,
    });
    if (appointment.contactId)
      await this.customerTimeline?.recordEvent({
        organizationId: context.organizationId,
        contactId: appointment.contactId,
        eventType: "APPOINTMENT_CANCELLED",
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        idempotencyKey: `appointment:cancelled:${appointment.id}`,
        description: appointment.title,
      });
    if (appointment.contactId)
      await this.automations?.cancelForContact(
        context.organizationId,
        appointment.contactId,
        ["MISSED_APPOINTMENT", "APPOINTMENT_COMPLETED", "UPCOMING_APPOINTMENT"],
        "Appointment was cancelled.",
      );
    return toAppointmentResponse(appointment);
  }

  async bookFromTool(
    context: TenantContext,
    input: {
      agentId: string;
      conversationId?: string;
      callId?: string;
      source: "VOICE" | "CHAT" | "WIDGET" | "MANUAL";
      customerName: string;
      phone: string;
      email?: string;
      preferredDate: string;
      preferredTime: string;
      timezone: string;
      notes?: string;
    },
  ) {
    await this.gates?.assertAppointmentCapacity(context.organizationId);
    const contact = await this.upsertContact(context.organizationId, {
      name: input.customerName,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    });
    const idempotencyKey = createAppointmentIdempotencyKey({
      agentId: input.agentId,
      conversationId: input.conversationId ?? null,
      callId: input.callId ?? null,
      customerName: input.customerName,
      phone: input.phone,
      email: input.email ?? null,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      timezone: input.timezone,
      source: input.source,
    });
    const appointment = await this.appointmentProvider.book(context, {
      agentId: input.agentId,
      contactId: contact.id,
      conversationId: input.conversationId,
      callId: input.callId,
      title: `Appointment with ${input.customerName}`,
      status: "CONFIRMED",
      timezone: input.timezone,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      durationMinutes: 30,
      source: input.source,
      notes: input.notes,
      idempotencyKey,
      metadata: {
        customerName: input.customerName,
        phone: input.phone,
        email: input.email ?? null,
      },
    } satisfies BookAppointmentInput);
    await this.audit(context, "appointment.confirmed", appointment.id, {
      confirmationNumber: appointment.confirmationNumber,
      source: appointment.source,
      tool: "book_appointment",
    });
    await this.trackAppointment(context.organizationId, appointment.id);
    await this.trackAppointmentAnalytics(context.organizationId, appointment);
    await this.scheduleNotifications(context, appointment);
    await this.customers?.resolveCustomer({
      organizationId: context.organizationId,
      contactId: contact.id,
      name: input.customerName,
      phone: input.phone,
      email: input.email,
      interaction: "APPOINTMENT",
      leadStatus: "BOOKED",
    });
    await this.customerTimeline?.recordEvent({
      organizationId: context.organizationId,
      contactId: contact.id,
      eventType: "APPOINTMENT_BOOKED",
      sourceEntityType: "Appointment",
      sourceEntityId: appointment.id,
      idempotencyKey: `appointment:booked:${appointment.id}`,
      description: appointment.title,
      occurredAt: appointment.createdAt,
    });
    await this.automations?.cancelForContact(
      context.organizationId,
      contact.id,
      ["NEW_LEAD", "NO_RESPONSE"],
      "Customer booked an appointment.",
    );
    await this.scheduleUpcomingAppointmentAutomation(context.organizationId, appointment);
    return {
      appointment,
      message: appointmentSuccessMessage(appointment),
    };
  }

  private async upsertContact(
    organizationId: string,
    input: { name: string; phone: string; email?: string; notes?: string },
  ) {
    const existing = await this.prisma.contact.findFirst({
      where: {
        organizationId,
        OR: [{ phone: input.phone }, ...(input.email ? [{ email: input.email }] : [])],
      },
    });
    if (existing) {
      return this.prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email ?? existing.email,
          notes: input.notes ?? existing.notes,
        },
      });
    }
    return this.prisma.contact.create({
      data: {
        organizationId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
    });
  }

  private trackAppointment(organizationId: string, appointmentId: string) {
    return (
      this.usage?.increment({
        organizationId,
        resourceType: "APPOINTMENTS",
        idempotencyKey: `appointment:created:${appointmentId}`,
      }) ?? Promise.resolve()
    );
  }

  private trackAppointmentAnalytics(
    organizationId: string,
    appointment: { id: string; agentId: string; source: string },
  ) {
    return (
      this.analytics?.record({
        organizationId,
        eventType: "APPOINTMENT_CREATED",
        idempotencyKey: `appointment:created:${appointment.id}`,
        agentId: appointment.agentId,
        metadata: { source: appointment.source },
      }) ?? Promise.resolve()
    );
  }

  private async scheduleNotifications(
    context: TenantContext,
    appointment: Parameters<CommunicationService["scheduleAppointmentMessages"]>[1],
  ) {
    try {
      const workflowReminder = await this.prisma.automationWorkflow.findFirst({
        where: {
          organizationId: context.organizationId,
          triggerType: "UPCOMING_APPOINTMENT",
          enabled: true,
        },
        select: { id: true },
      });
      await this.communications.scheduleAppointmentMessages(context, {
        ...appointment,
        suppressReminder: Boolean(workflowReminder),
      });
    } catch (error) {
      await this.audit(context, "appointment.notification_failed", appointment.id, {
        reason: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  private scheduleUpcomingAppointmentAutomation(
    organizationId: string,
    appointment: {
      id: string;
      contactId: string | null;
      agentId: string;
      title: string;
      startTime: Date;
      timezone: string;
    },
    triggerVersion?: string,
  ) {
    if (!appointment.contactId) return Promise.resolve({ scheduled: 0, executions: [] });
    return (
      this.automations?.trigger({
        organizationId,
        triggerType: "UPCOMING_APPOINTMENT",
        contactId: appointment.contactId,
        sourceEntityType: "Appointment",
        sourceEntityId: appointment.id,
        triggerId: triggerVersion
          ? `UPCOMING_APPOINTMENT:Appointment:${appointment.id}:${triggerVersion}`
          : undefined,
        reasonType: "APPOINTMENT_REMINDER",
        followUpReason: `${appointment.title} is scheduled for ${appointment.startTime.toISOString()} in ${appointment.timezone}.`,
        reasonDescription: `${appointment.title} is scheduled for ${appointment.startTime.toISOString()} in ${appointment.timezone}.`,
        metadata: {
          eventAt: appointment.startTime.toISOString(),
          agentId: appointment.agentId,
        },
      }) ?? Promise.resolve({ scheduled: 0, executions: [] })
    );
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.appointments.createAuditEvent({
      organizationId: context.organizationId,
      actorUserId: context.userId.startsWith("public-") ? undefined : context.userId,
      action,
      entityType: "Appointment",
      entityId,
      metadata,
    });
  }
}

export function createAppointmentIdempotencyKey(input: Record<string, unknown>) {
  const stable = Object.keys(input)
    .sort()
    .map((key) => `${key}:${String(input[key] ?? "")}`)
    .join("|");
  return createHash("sha256").update(stable).digest("hex");
}

export function mapToolSource(source: "CHAT" | "VOICE" | "WIDGET" | "TEST") {
  if (source === "VOICE") return "VOICE";
  if (source === "WIDGET") return "WIDGET";
  return "CHAT";
}

function toAppointmentResponse(appointment: {
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
  call?: {
    id: string;
    twilioCallSid: string;
    callerNumber: string;
    calledNumber: string;
  } | null;
}) {
  return appointment;
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toUtcTime(date: Date): string {
  return `${date.getUTCHours().toString().padStart(2, "0")}:${date
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}`;
}
