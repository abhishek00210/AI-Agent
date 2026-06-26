import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AutomationExecutionStatus, Prisma } from "../../../generated/prisma";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { AutomationEngineService } from "./automation-engine.service";
import { AutomationSchedulerService } from "./automation-scheduler.service";
import {
  CancelAutomationDto,
  ListAutomationExecutionsDto,
  UpdateAutomationRuleDto,
  UpdateAutomationTemplateDto,
  UpdateAutomationWorkflowDto,
} from "./dto/automation.dto";

@UseGuards(JwtAuthGuard)
@Controller(["automation", "automations"])
export class AutomationController {
  constructor(
    private readonly engine: AutomationEngineService,
    private readonly scheduler: AutomationSchedulerService,
    private readonly tenant: TenantService,
  ) {}

  @Get() dashboard(@CurrentUser() user: JwtPayload) {
    return this.engine.dashboard(this.tenant.fromUser(user).organizationId);
  }
  @Get("workflows") async workflows(@CurrentUser() user: JwtPayload) {
    return (await this.engine.dashboard(this.tenant.fromUser(user).organizationId)).workflows;
  }
  @Get("message-templates") templates(@CurrentUser() user: JwtPayload) {
    return this.engine.templates(this.tenant.fromUser(user).organizationId);
  }
  @Get("executions") executions(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListAutomationExecutionsDto,
  ) {
    return this.engine.listExecutions(this.tenant.fromUser(user).organizationId, {
      ...query,
      status: query.status as AutomationExecutionStatus | undefined,
    });
  }
  @Get("customers/:id") customerExecutions(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ListAutomationExecutionsDto,
  ) {
    return this.engine.listExecutions(this.tenant.fromUser(user).organizationId, {
      ...query,
      customerProfileId: id,
      status: query.status as AutomationExecutionStatus | undefined,
    });
  }
  @Patch("workflows/:id") workflow(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateAutomationWorkflowDto,
  ) {
    return this.engine.updateWorkflow(this.tenant.fromUser(user).organizationId, id, input);
  }
  @Post("workflows/:id/pause") pause(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.engine.updateWorkflow(this.tenant.fromUser(user).organizationId, id, {
      enabled: false,
    });
  }
  @Post("workflows/:id/resume") resume(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.engine.updateWorkflow(this.tenant.fromUser(user).organizationId, id, {
      enabled: true,
    });
  }
  @Patch("rules/:id") rule(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateAutomationRuleDto,
  ) {
    return this.engine.updateRule(this.tenant.fromUser(user).organizationId, id, {
      ...input,
      conditions: input.conditions as Prisma.InputJsonValue | undefined,
    });
  }
  @Patch("templates/:id") template(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateAutomationTemplateDto,
  ) {
    return this.engine.updateTemplate(this.tenant.fromUser(user).organizationId, id, input);
  }
  @Post("executions/:id/cancel") cancel(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CancelAutomationDto,
  ) {
    return this.engine.cancelExecution(
      this.tenant.fromUser(user).organizationId,
      id,
      input.reason ?? "Cancelled by a workspace user.",
    );
  }
  @Get("queue") queue() {
    return this.scheduler.depth();
  }
}
