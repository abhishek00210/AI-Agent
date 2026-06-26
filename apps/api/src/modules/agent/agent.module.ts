import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentRepository } from "./repositories/agent.repository";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [AuthModule, TenantModule, BillingModule],
  controllers: [AgentController],
  providers: [AgentService, AgentRepository],
  exports: [AgentService],
})
export class AgentModule {}
