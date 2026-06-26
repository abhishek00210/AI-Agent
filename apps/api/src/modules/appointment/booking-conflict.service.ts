import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class BookingConflictService {
  constructor(private readonly prisma: PrismaService) {}

  async hasConflict(input: {
    organizationId: string;
    agentId: string;
    startTime: Date;
    endTime: Date;
    bufferBeforeMinutes?: number;
    bufferAfterMinutes?: number;
    excludeAppointmentId?: string;
  }): Promise<boolean> {
    const startBoundary = new Date(
      input.startTime.getTime() - (input.bufferAfterMinutes ?? 0) * 60_000,
    );
    const endBoundary = new Date(
      input.endTime.getTime() + (input.bufferBeforeMinutes ?? 0) * 60_000,
    );
    const count = await this.prisma.appointment.count({
      where: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        status: { in: ["PENDING", "CONFIRMED"] },
        ...(input.excludeAppointmentId ? { id: { not: input.excludeAppointmentId } } : {}),
        startTime: { lt: endBoundary },
        endTime: { gt: startBoundary },
      },
    });
    return count > 0;
  }
}
