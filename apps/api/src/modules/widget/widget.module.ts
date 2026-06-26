import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OpenAiModule } from "../openai/openai.module";
import { TenantModule } from "../tenant/tenant.module";
import { WidgetRepository } from "./repositories/widget.repository";
import { WidgetRateLimitService } from "./widget-rate-limit.service";
import { PublicWidgetController, WidgetController } from "./widget.controller";
import { WidgetService } from "./widget.service";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AuthModule, TenantModule, OpenAiModule, BillingModule],
  controllers: [WidgetController, PublicWidgetController],
  providers: [WidgetRepository, WidgetRateLimitService, WidgetService],
})
export class WidgetModule {}
