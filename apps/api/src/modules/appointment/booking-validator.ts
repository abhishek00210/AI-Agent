import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AppointmentStatus } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import {
  getWeekday,
  minutesSinceMidnight,
  timeToMinutes,
  canonicalTimezone,
} from "./appointment-time";
import { AvailabilityService } from "./availability.service";
import { BookingConflictService } from "./booking-conflict.service";
import { AppointmentRepository } from "./repositories/appointment.repository";

@Injectable()
export class BookingValidator {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly availability: AvailabilityService,
    private readonly conflicts: BookingConflictService,
  ) {}

  async validate(input: {
    context: TenantContext;
    agentId: string;
    contactId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
    startTime: Date;
    endTime: Date;
    timezone: string;
    status: AppointmentStatus;
    excludeAppointmentId?: string;
  }) {
    if (input.endTime <= input.startTime) {
      throw new BadRequestException("Appointment end time must be after start time.");
    }

    if (input.startTime <= new Date()) {
      throw new BadRequestException("Appointment cannot be booked in the past.");
    }

    const agent = await this.appointments.findAgent(input.context.organizationId, input.agentId);
    if (!agent) throw new NotFoundException("Agent not found.");
    if (agent.status !== "ACTIVE") {
      throw new BadRequestException("Only active agents can receive appointments.");
    }

    if (input.contactId) {
      const contact = await this.appointments.findContact(
        input.context.organizationId,
        input.contactId,
      );
      if (!contact) throw new NotFoundException("Contact not found.");
    }

    if (input.conversationId) {
      const conversation = await this.appointments.findConversation(
        input.context.organizationId,
        input.conversationId,
      );
      if (!conversation) throw new NotFoundException("Conversation not found.");
      if (conversation.agentId !== input.agentId) {
        throw new ForbiddenException("Conversation does not belong to the selected agent.");
      }
    }

    if (input.callId) {
      const call = await this.appointments.findCall(input.context.organizationId, input.callId);
      if (!call) throw new NotFoundException("Call not found.");
      if (call.agentId !== input.agentId) {
        throw new ForbiddenException("Call does not belong to the selected agent.");
      }
    }

    if (["PENDING", "CONFIRMED"].includes(input.status)) {
      const availabilityRule = await this.assertWithinAvailability(input);
      const conflict = await this.conflicts.hasConflict({
        organizationId: input.context.organizationId,
        agentId: input.agentId,
        startTime: input.startTime,
        endTime: input.endTime,
        bufferBeforeMinutes: availabilityRule.bufferBeforeMinutes,
        bufferAfterMinutes: availabilityRule.bufferAfterMinutes,
        excludeAppointmentId: input.excludeAppointmentId,
      });
      if (conflict) {
        throw new BadRequestException(
          "Requested appointment time conflicts with an existing booking.",
        );
      }
    }
  }

  private async assertWithinAvailability(input: {
    context: TenantContext;
    startTime: Date;
    endTime: Date;
    timezone: string;
  }) {
    const date = input.startTime.toISOString().slice(0, 10);
    const rules = await this.availability.rulesForDate(input.context.organizationId, date);
    if (rules.length === 0) {
      throw new BadRequestException("No availability is configured for this day.");
    }

    const weekday = getWeekday(input.startTime, input.timezone);
    const startMinute = minutesSinceMidnight(input.startTime, input.timezone);
    const endMinute = minutesSinceMidnight(input.endTime, input.timezone);
    const match = rules.find((rule) => {
      if (rule.dayOfWeek !== weekday) return false;
      if (canonicalTimezone(rule.timezone) !== canonicalTimezone(input.timezone)) return false;
      const open = timeToMinutes(rule.startTime) + rule.bufferBeforeMinutes;
      const close = timeToMinutes(rule.endTime) - rule.bufferAfterMinutes;
      return startMinute >= open && endMinute <= close;
    });

    if (!match) {
      throw new BadRequestException(
        "Requested appointment time is outside configured availability.",
      );
    }

    return match;
  }
}
