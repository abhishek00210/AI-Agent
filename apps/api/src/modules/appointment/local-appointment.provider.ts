import { BadRequestException, Injectable } from "@nestjs/common";
import type { AppointmentSource, AppointmentStatus, Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { addMinutes, formatDateInTimezone, localDateTimeToUtc } from "./appointment-time";
import type { AppointmentProvider, BookAppointmentInput } from "./appointment-provider";
import { BookingValidator } from "./booking-validator";
import { ConfirmationService } from "./confirmation.service";
import { AppointmentRepository } from "./repositories/appointment.repository";

@Injectable()
export class LocalAppointmentProvider implements AppointmentProvider {
  readonly name = "local";

  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly validator: BookingValidator,
    private readonly confirmations: ConfirmationService,
  ) {}

  async book(context: TenantContext, input: BookAppointmentInput) {
    if (input.idempotencyKey) {
      const existing = await this.appointments.findByIdempotencyKey(
        context.organizationId,
        input.idempotencyKey,
      );
      if (existing) return existing;
    }

    const startTime = localDateTimeToUtc(input.preferredDate, input.preferredTime, input.timezone);
    const endTime = addMinutes(startTime, input.durationMinutes);
    const status = (input.status ?? "CONFIRMED") as AppointmentStatus;

    await this.validator.validate({
      context,
      agentId: input.agentId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      callId: input.callId,
      startTime,
      endTime,
      timezone: input.timezone,
      status,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.appointments.createTransactional({
          organizationId: context.organizationId,
          agentId: input.agentId,
          contactId: input.contactId,
          conversationId: input.conversationId,
          callId: input.callId,
          title: input.title.trim(),
          description: normalizeOptionalText(input.description),
          status,
          timezone: input.timezone,
          startTime,
          endTime,
          source: input.source as AppointmentSource,
          confirmationNumber: this.confirmations.generate(),
          idempotencyKey: input.idempotencyKey,
          notes: normalizeOptionalText(input.notes),
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        });
      } catch (error) {
        if (isUniqueConstraintError(error) && input.idempotencyKey) {
          const existing = await this.appointments.findByIdempotencyKey(
            context.organizationId,
            input.idempotencyKey,
          );
          if (existing) return existing;
        }
        if (isUniqueConfirmationError(error)) continue;
        if (isConflictOrSerializationError(error)) {
          throw new BadRequestException("Requested appointment time is no longer available.");
        }
        throw error;
      }
    }

    throw new BadRequestException("Could not generate a unique confirmation number.");
  }
}

export function appointmentSuccessMessage(appointment: {
  startTime: Date;
  timezone: string;
  confirmationNumber: string;
}) {
  return `Appointment booked for ${formatDateInTimezone(
    appointment.startTime,
    appointment.timezone,
  )}. Confirmation number: ${appointment.confirmationNumber}.`;
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isConflictOrSerializationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["P2004", "P2034"].includes(String((error as { code?: unknown }).code))
  );
}

function isUniqueConfirmationError(error: unknown) {
  return isUniqueConstraintError(error);
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "P2002"
  );
}
