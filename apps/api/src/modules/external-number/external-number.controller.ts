import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import {
  AssignExternalNumberAgentDto,
  CreateExternalNumberDto,
  ResendExternalNumberOtpDto,
  VerifyExternalNumberDto,
} from "./dto/external-number.dto";
import { ExternalNumberService } from "./external-number.service";
import { ForwardingTestService } from "./forwarding-test.service";
import { VerificationService } from "./verification.service";

@UseGuards(JwtAuthGuard)
@Controller("voice/external-numbers")
export class ExternalNumberController {
  constructor(
    private readonly externalNumbers: ExternalNumberService,
    private readonly verification: VerificationService,
    private readonly tests: ForwardingTestService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.externalNumbers.list(this.tenant.fromUser(user));
  }

  @Get(":id")
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.externalNumbers.get(this.tenant.fromUser(user), id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateExternalNumberDto) {
    return this.externalNumbers.create(this.tenant.fromUser(user), body);
  }

  @Post("verify")
  async verify(@CurrentUser() user: JwtPayload, @Body() body: VerifyExternalNumberDto) {
    const context = this.tenant.fromUser(user);
    await this.verification.verify(context, body.id, body.code);
    return this.externalNumbers.get(context, body.id);
  }

  @Post(":id/resend")
  resend(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ResendExternalNumberOtpDto,
  ) {
    return this.verification.send(this.tenant.fromUser(user), id, body.verificationMethod);
  }

  @Post(":id/assign-agent")
  assign(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AssignExternalNumberAgentDto,
  ) {
    return this.externalNumbers.assign(this.tenant.fromUser(user), id, body);
  }

  @Post(":id/test-call")
  testCall(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.tests.start(this.tenant.fromUser(user), id);
  }

  @Post(":id/disable")
  disable(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.externalNumbers.disable(this.tenant.fromUser(user), id);
  }
}
