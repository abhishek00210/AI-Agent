import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics.dto";

@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly tenants: TenantService,
  ) {}
  @Get() dashboard(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.analytics.dashboard(
      this.tenants.fromUser(user).organizationId,
      this.analytics.resolveRange(query),
    );
  }
  @Get("overview") overview(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.section(user, query, "overview");
  }
  @Get("calls") calls(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.section(user, query, "series");
  }
  @Get("leads") leads(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.section(user, query, "series");
  }
  @Get("revenue") revenue(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    return this.section(user, query, "revenue");
  }
  @Get("conversions") conversions(
    @CurrentUser() user: JwtPayload,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.section(user, query, "overview");
  }
  @Get("capabilities") capabilities() {
    return this.analytics.capabilities();
  }
  private async section(
    user: JwtPayload,
    query: AnalyticsQueryDto,
    key: "overview" | "series" | "revenue",
  ) {
    const data = await this.analytics.dashboard(
      this.tenants.fromUser(user).organizationId,
      this.analytics.resolveRange(query),
    );
    return data[key];
  }
}
