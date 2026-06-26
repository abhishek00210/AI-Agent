import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { UsageModule } from "../usage/usage.module";
import { CustomerController } from "./customer.controller";
import { CustomerResolverService } from "./customer-resolver.service";
import { CustomerTimelineModule } from "../customer-timeline/customer-timeline.module";

@Module({ imports: [AuthModule, TenantModule, UsageModule, CustomerTimelineModule], controllers: [CustomerController], providers: [CustomerResolverService], exports: [CustomerResolverService] })
export class CustomerModule {}
