import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { WorkflowTemplateCategory } from "../../../generated/prisma";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import {
  ActivateWorkflowTemplateDto,
  CreateWorkflowDto,
  ListWorkflowTemplatesDto,
} from "./dto/workflow-builder.dto";
import { WorkflowCloneService } from "./workflow-clone.service";
import { WorkflowTemplateService } from "./workflow-template.service";

@UseGuards(JwtAuthGuard)
@Controller(["automation", "automations"])
export class WorkflowBuilderController {
  constructor(
    private readonly templates: WorkflowTemplateService,
    private readonly clones: WorkflowCloneService,
    private readonly tenant: TenantService,
  ) {}

  @Get("templates")
  list(@CurrentUser() user: JwtPayload, @Query() query: ListWorkflowTemplatesDto) {
    return this.templates.list(
      this.tenant.fromUser(user).organizationId,
      query.category as WorkflowTemplateCategory | undefined,
    );
  }

  @Get("templates/:id")
  get(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.templates.get(this.tenant.fromUser(user).organizationId, id);
  }

  @Post("templates/:id/clone")
  clone(
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: ActivateWorkflowTemplateDto,
  ) {
    return this.clones.activate(this.tenant.fromUser(user).organizationId, id, input);
  }

  @Post("workflows")
  create(@CurrentUser() user: JwtPayload, @Body() input: CreateWorkflowDto) {
    return this.clones.createCustom(this.tenant.fromUser(user).organizationId, {
      ...input,
      configuration: input.configuration,
    });
  }
}
