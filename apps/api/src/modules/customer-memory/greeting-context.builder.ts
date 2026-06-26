import { Injectable } from "@nestjs/common";
import type { CustomerMemoryContext } from "./customer-memory.types";

@Injectable()
export class GreetingContextBuilder {
  build(memory: CustomerMemoryContext | null) {
    if (!memory?.recognized) {
      return {
        customerName: null,
        lastContactAt: null,
        lastSummary: null,
        upcomingAppointment: null,
        openFollowUp: null,
        leadStatus: "NEW" as const,
      };
    }
    return {
      customerName: memory.customer.name,
      lastContactAt: memory.customer.lastContactAt,
      lastSummary: memory.recentSummaries[0] ?? null,
      upcomingAppointment:
        memory.appointments.find(
          (appointment) =>
            appointment.status === "CONFIRMED" && appointment.startTime.getTime() > Date.now(),
        ) ?? null,
      openFollowUp: memory.openFollowUps[0] ?? null,
      leadStatus: memory.customer.leadStatus,
    };
  }
}
