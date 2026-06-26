import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { CustomerMemoryContextService } from "./customer-memory-context.service";
import { CustomerMemoryController } from "./customer-memory.controller";
import { GreetingContextBuilder } from "./greeting-context.builder";
import { GreetingPolicyEngine } from "./greeting-policy.engine";
import { GreetingService } from "./greeting.service";
import { PromptMemoryBuilder } from "./prompt-memory.builder";

@Global()
@Module({
  imports: [AuthModule, TenantModule],
  controllers: [CustomerMemoryController],
  providers: [
    CustomerMemoryContextService,
    PromptMemoryBuilder,
    GreetingContextBuilder,
    GreetingPolicyEngine,
    GreetingService,
  ],
  exports: [
    CustomerMemoryContextService,
    PromptMemoryBuilder,
    GreetingContextBuilder,
    GreetingPolicyEngine,
    GreetingService,
  ],
})
export class CustomerMemoryModule {}
