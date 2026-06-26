import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AppointmentService } from "./appointment.service";
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from "./dto/appointment.dto";

@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentController {
  constructor(
    private readonly appointments: AppointmentService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListAppointmentsQueryDto) {
    return this.appointments.list(this.tenant.fromUser(user), query);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateAppointmentDto) {
    return this.appointments.create(this.tenant.fromUser(user), body);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) appointmentId: string) {
    return this.appointments.getById(this.tenant.fromUser(user), appointmentId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) appointmentId: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    return this.appointments.update(this.tenant.fromUser(user), appointmentId, body);
  }

  @Delete(":id")
  cancel(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) appointmentId: string) {
    return this.appointments.cancel(this.tenant.fromUser(user), appointmentId);
  }
}
