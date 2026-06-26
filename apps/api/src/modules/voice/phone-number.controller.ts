import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AssignPhoneNumberAgentDto, ListPhoneNumbersQueryDto } from "./dto/phone-number.dto";
import { PhoneNumberService } from "./phone-number.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/phone-numbers")
export class PhoneNumberController {
  constructor(
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenant: TenantService,
  ) {}

  @Post("sync")
  sync(@CurrentUser() user: JwtPayload) {
    return this.phoneNumbers.sync(this.tenant.fromUser(user));
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListPhoneNumbersQueryDto) {
    return this.phoneNumbers.list(this.tenant.fromUser(user), query);
  }

  @Get(":id")
  details(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) phoneNumberId: string) {
    return this.phoneNumbers.getById(this.tenant.fromUser(user), phoneNumberId);
  }

  @Post(":id/assign-agent")
  assignAgent(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) phoneNumberId: string,
    @Body() body: AssignPhoneNumberAgentDto,
  ) {
    return this.phoneNumbers.assignAgent(this.tenant.fromUser(user), phoneNumberId, body);
  }

  @Post(":id/unassign")
  unassign(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) phoneNumberId: string) {
    return this.phoneNumbers.unassign(this.tenant.fromUser(user), phoneNumberId);
  }

  @Post(":id/disable")
  disable(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) phoneNumberId: string) {
    return this.phoneNumbers.disable(this.tenant.fromUser(user), phoneNumberId);
  }

  @Post(":id/enable")
  enable(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) phoneNumberId: string) {
    return this.phoneNumbers.enable(this.tenant.fromUser(user), phoneNumberId);
  }
}
