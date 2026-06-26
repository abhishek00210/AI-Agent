import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { CustomerMemoryContextService } from "./customer-memory-context.service";
import { GreetingService } from "./greeting.service";

@UseGuards(JwtAuthGuard)
@Controller("customers/:id/memory-context")
export class CustomerMemoryController {
  constructor(
    private readonly memory: CustomerMemoryContextService,
    private readonly greetings: GreetingService,
    private readonly tenant: TenantService,
  ) {}

  @Get()
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    const context = this.tenant.fromUser(user);
    return this.memory.buildContext({
      organizationId: context.organizationId,
      customerProfileId: id,
      interactionId: `dashboard:${id}`,
      channel: "ADMIN",
      track: false,
    });
  }

  @Get("greeting-preview")
  async greetingPreview(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    const context = this.tenant.fromUser(user);
    const memory = await this.memory.buildContext({
      organizationId: context.organizationId,
      customerProfileId: id,
      interactionId: `dashboard:greeting:${id}`,
      channel: "ADMIN",
      track: false,
    });
    return this.greetings.build({
      organizationId: context.organizationId,
      interactionId: `dashboard:greeting:${id}`,
      channel: "ADMIN",
      memory,
      track: false,
    });
  }
}
