import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import type { TenantContext } from "../tenant/tenant.service";
import { addMinutes, getWeekday, localDateTimeToUtc, timeToMinutes } from "./appointment-time";
import type { AvailabilitySlotsQueryDto } from "./dto/appointment.dto";
import type { CreateAvailabilityDto, UpdateAvailabilityDto } from "./dto/availability.dto";

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  list(context: TenantContext) {
    return this.prisma.availability.findMany({
      where: { organizationId: context.organizationId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async create(context: TenantContext, input: CreateAvailabilityDto) {
    this.assertValidWindow(input.startTime, input.endTime);
    const rule = await this.prisma.availability.create({
      data: {
        organizationId: context.organizationId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        isEnabled: input.isEnabled ?? true,
        timezone: input.timezone,
        bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
        bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
      },
    });
    await this.audit(context, "availability.created", rule.id, rule as Prisma.InputJsonValue);
    return rule;
  }

  async update(context: TenantContext, availabilityId: string, input: UpdateAvailabilityDto) {
    const existing = await this.prisma.availability.findFirst({
      where: { id: availabilityId, organizationId: context.organizationId },
    });
    if (!existing) throw new NotFoundException("Availability rule not found.");
    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;
    this.assertValidWindow(startTime, endTime);

    const rule = await this.prisma.availability.update({
      where: { id: availabilityId },
      data: {
        ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
        ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
        ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.bufferBeforeMinutes !== undefined
          ? { bufferBeforeMinutes: input.bufferBeforeMinutes }
          : {}),
        ...(input.bufferAfterMinutes !== undefined
          ? { bufferAfterMinutes: input.bufferAfterMinutes }
          : {}),
      },
    });
    await this.audit(context, "availability.updated", rule.id, rule as Prisma.InputJsonValue);
    return rule;
  }

  async slots(context: TenantContext, query: AvailabilitySlotsQueryDto) {
    const duration = query.durationMinutes ?? 30;
    const rules = await this.rulesForDate(context.organizationId, query.date);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: context.organizationId,
        ...(query.agentId ? { agentId: query.agentId } : {}),
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: {
          gte: localDateTimeToUtc(query.date.slice(0, 10), "00:00", rules[0]?.timezone ?? "UTC"),
          lt: localDateTimeToUtc(query.date.slice(0, 10), "23:59", rules[0]?.timezone ?? "UTC"),
        },
      },
      select: { startTime: true, endTime: true },
    });

    return rules.flatMap((rule) => {
      const slots: Array<{ startTime: Date; endTime: Date; timezone: string }> = [];
      let cursor = timeToMinutes(rule.startTime) + rule.bufferBeforeMinutes;
      const latestStart = timeToMinutes(rule.endTime) - rule.bufferAfterMinutes - duration;
      while (cursor <= latestStart) {
        const hour = Math.floor(cursor / 60)
          .toString()
          .padStart(2, "0");
        const minute = (cursor % 60).toString().padStart(2, "0");
        const startTime = localDateTimeToUtc(query.date.slice(0, 10), `${hour}:${minute}`, rule.timezone);
        const endTime = addMinutes(startTime, duration);
        const busy = appointments.some((appointment) => {
          const blockedStart = addMinutes(appointment.startTime, -rule.bufferBeforeMinutes);
          const blockedEnd = addMinutes(appointment.endTime, rule.bufferAfterMinutes);
          return blockedStart < endTime && blockedEnd > startTime;
        });
        if (!busy) slots.push({ startTime, endTime, timezone: rule.timezone });
        cursor += duration;
      }
      return slots;
    });
  }

  async rulesForDate(organizationId: string, date: string) {
    const probe = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
    const candidateRules = await this.prisma.availability.findMany({
      where: { organizationId, isEnabled: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return candidateRules.filter((rule) => getWeekday(probe, rule.timezone) === rule.dayOfWeek);
  }

  private assertValidWindow(startTime: string, endTime: string) {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new BadRequestException("Availability end time must be after start time.");
    }
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId.startsWith("public-") ? undefined : context.userId,
        action,
        entityType: "Availability",
        entityId,
        metadata,
      },
    });
  }
}
