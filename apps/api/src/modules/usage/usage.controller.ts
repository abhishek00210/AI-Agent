import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { FeatureGateService } from "../billing/feature-gate.service";
import { TenantService } from "../tenant/tenant.service";
import { UsageHistoryQueryDto } from "./dto/usage.dto";
import { UsageService, usageLimitsForPlan } from "./usage.service";

@UseGuards(JwtAuthGuard)
@Controller("usage")
export class UsageController {
  constructor(
    private readonly usage: UsageService,
    private readonly gates: FeatureGateService,
    private readonly tenants: TenantService,
  ) {}

  @Get()
  async summary(@CurrentUser() user: JwtPayload) {
    const context = this.tenants.fromUser(user);
    const entitlements = await this.gates.resolve(context.organizationId);
    const usage = await this.usage.getRemaining(
      context.organizationId,
      usageLimitsForPlan(entitlements.plan, entitlements.limits),
    );
    return {
      plan: entitlements.plan,
      state: entitlements.state,
      allowed: entitlements.allowed,
      ...usage,
      projection: projectUsage(usage.resources, usage.periodStart, usage.periodEnd),
    };
  }

  @Get("current")
  current(@CurrentUser() user: JwtPayload) {
    return this.usage.getUsage(this.tenants.fromUser(user).organizationId);
  }

  @Get("history")
  history(@CurrentUser() user: JwtPayload, @Query() query: UsageHistoryQueryDto) {
    return this.usage.history(this.tenants.fromUser(user).organizationId, query);
  }

  @Get("limits")
  async limits(@CurrentUser() user: JwtPayload) {
    const organizationId = this.tenants.fromUser(user).organizationId;
    const entitlements = await this.gates.resolve(organizationId);
    return {
      plan: entitlements.plan,
      periodStart: entitlements.periodStart,
      periodEnd: entitlements.periodEnd,
      limits: usageLimitsForPlan(entitlements.plan, entitlements.limits),
    };
  }
}

function projectUsage(
  resources: Record<string, { used: number; limit: number | null; overage: number }>,
  periodStart: string,
  periodEnd: string,
) {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const elapsedRatio = Math.min(1, Math.max(0.01, (Date.now() - start) / Math.max(1, end - start)));
  return Object.fromEntries(
    Object.entries(resources).map(([resource, value]) => [
      resource,
      {
        projected: Number((value.used / elapsedRatio).toFixed(2)),
        included: value.limit,
        overage: value.overage,
        estimatedNextInvoiceCents: 0,
      },
    ]),
  );
}
