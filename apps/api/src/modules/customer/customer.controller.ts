import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CustomerResolverService } from "./customer-resolver.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";

@UseGuards(JwtAuthGuard)
@Controller("customers")
export class CustomerController {
  constructor(private readonly customers: CustomerResolverService, private readonly tenant: TenantService) {}
  @Get() list(@CurrentUser() user: JwtPayload, @Query("search") search?: string) { return this.customers.list(this.tenant.fromUser(user).organizationId, search?.trim()); }
  @Get(":id") get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) { return this.customers.get(this.tenant.fromUser(user).organizationId, id); }
  @Post() create(@CurrentUser() user: JwtPayload, @Body() body: CreateCustomerDto) { return this.customers.create(this.tenant.fromUser(user).organizationId, body); }
  @Patch(":id") update(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateCustomerDto) { return this.customers.update(this.tenant.fromUser(user).organizationId, id, body); }
}

