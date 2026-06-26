import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { AppointmentController } from "./appointment.controller";
import { AppointmentService } from "./appointment.service";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityService } from "./availability.service";
import { APPOINTMENT_PROVIDER } from "./appointment-provider";
import { BookingConflictService } from "./booking-conflict.service";
import { BookingValidator } from "./booking-validator";
import { ConfirmationService } from "./confirmation.service";
import { LocalAppointmentProvider } from "./local-appointment.provider";
import { AppointmentRepository } from "./repositories/appointment.repository";
import { CommunicationModule } from "../communication/communication.module";
import { BillingModule } from "../billing/billing.module";
import { CustomerModule } from "../customer/customer.module";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";
import { AutomationModule } from "../automation/automation.module";

@Module({
  imports: [AuthModule, TenantModule, CommunicationModule, BillingModule, CustomerModule, CustomerTimelineModule, AutomationModule],
  controllers: [AppointmentController, AvailabilityController],
  providers: [
    AppointmentRepository,
    AvailabilityService,
    BookingConflictService,
    BookingValidator,
    ConfirmationService,
    LocalAppointmentProvider,
    { provide: APPOINTMENT_PROVIDER, useExisting: LocalAppointmentProvider },
    AppointmentService,
  ],
  exports: [AppointmentService, AvailabilityService],
})
export class AppointmentModule {}
