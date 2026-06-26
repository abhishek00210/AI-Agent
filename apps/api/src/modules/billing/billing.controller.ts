import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { BillingService } from "./billing.service";
import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreateCheckoutDto,
  PauseSubscriptionDto,
} from "./dto/billing.dto";

@UseGuards(JwtAuthGuard)
@Controller("billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly tenants: TenantService,
  ) {}

  @Post("checkout")
  checkout(@CurrentUser() user: JwtPayload, @Body() input: CreateCheckoutDto) {
    return this.billing.checkout(this.tenants.fromUser(user), input.plan);
  }

  @Post("portal")
  portal(@CurrentUser() user: JwtPayload) {
    return this.billing.portal(this.tenants.fromUser(user));
  }

  @Get("subscription")
  subscription(@CurrentUser() user: JwtPayload) {
    return this.billing.subscription(this.tenants.fromUser(user));
  }

  @Get("plans")
  plans() {
    return this.billing.plans();
  }

  @Post("subscription/cancel")
  cancel(@CurrentUser() user: JwtPayload, @Body() input: CancelSubscriptionDto) {
    return this.billing.cancel(this.tenants.fromUser(user), input.mode);
  }

  @Post("subscription/change-plan")
  changePlan(@CurrentUser() user: JwtPayload, @Body() input: ChangePlanDto) {
    return this.billing.changePlan(this.tenants.fromUser(user), input.plan);
  }

  @Post("subscription/pause")
  pause(@CurrentUser() user: JwtPayload, @Body() input: PauseSubscriptionDto) {
    return this.billing.pause(this.tenants.fromUser(user), input.days);
  }

  @Post("subscription/resume")
  resume(@CurrentUser() user: JwtPayload) {
    return this.billing.resume(this.tenants.fromUser(user));
  }

  @Get("entitlements")
  entitlements(@CurrentUser() user: JwtPayload) {
    return this.billing.entitlements(this.tenants.fromUser(user));
  }

  @Get("monitoring")
  monitoring() {
    return this.billing.monitoring();
  }

  @Get("capabilities")
  capabilities() {
    return this.billing.capabilities();
  }
}
