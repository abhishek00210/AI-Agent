import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminService } from "./admin.service";
import type { AdminJwtPayload } from "./admin.types";
import {
  AdminFeatureOverrideDto,
  AdminAssignExternalNumberDto,
  AdminCancelSubscriptionDto,
  AdminListQueryDto,
  AdminOrganizationLocalizationDto,
  AdminLoginDto,
  AdminPlanOverrideDto,
  AdminResumeSubscriptionDto,
  AdminStatusDto,
  AgentStatusDto,
  CreateSupportTicketDto,
  DeleteConfirmDto,
  GrantTrialDto,
  ResetUserPasswordDto,
  UpdateSupportTicketDto,
  UserStatusDto,
} from "./dto/admin.dto";
import { AdminUpdatePortRequestDto } from "../port-request/dto/port-request.dto";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";
import { GreetingService } from "../customer-memory/greeting.service";
import { AutomationEngineService } from "../automation/automation-engine.service";
import { AdminAuditService } from "./admin-audit.service";
import { WorkflowTemplateService } from "../workflow-builder/workflow-template.service";
import { CampaignService } from "../campaign/campaign.service";
import { PerformanceAuditService } from "../performance/performance-audit.service";
import { TelephonyHealthService } from "../telephony/telephony-health.service";
import { PaymentProviderHealthService } from "../payments/payment-provider-health.service";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly admin: AdminService) {}

  @Post("login")
  login(@Body() body: AdminLoginDto, @Req() request: FastifyRequest) {
    return this.admin.login(body, request.ip);
  }

  @UseGuards(AdminAuthGuard)
  @Get("me")
  me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.admin.me(admin);
  }
}

@UseGuards(AdminAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly customerMemory: CustomerMemoryContextService,
    private readonly greetings: GreetingService,
    private readonly automations: AutomationEngineService,
    private readonly adminAudit: AdminAuditService,
    private readonly workflowTemplates: WorkflowTemplateService,
    private readonly campaigns: CampaignService,
    private readonly performanceAudit: PerformanceAuditService,
    private readonly telephonyHealth: TelephonyHealthService,
    private readonly paymentProviderHealth: PaymentProviderHealthService,
  ) {}

  @Get("dashboard")
  dashboard() {
    return this.admin.dashboard();
  }

  @Get("performance")
  performance() {
    return this.performanceAudit.report();
  }

  @Get("providers")
  providers() {
    return this.telephonyHealth.providers();
  }

  @Get("payment-providers")
  paymentProviders() {
    return this.paymentProviderHealth.providers();
  }

  @Get("performance/report.md")
  async performanceMarkdown(@Res() reply: FastifyReply) {
    return reply.type("text/markdown; charset=utf-8").send(await this.performanceAudit.markdown());
  }

  @Get("automations")
  automationsOverview() {
    return this.automations.adminOverview();
  }

  @Get("campaigns")
  campaignsOverview(@Query("limit") limit?: string) {
    return this.campaigns.adminList(limit ? Number(limit) : 100);
  }

  @Get("lead-imports")
  leadImports(@Query("limit") limit?: string) {
    return this.admin.leadImports(limit ? Number(limit) : 250);
  }

  @Post("campaigns/:id/pause")
  async pauseCampaign(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ) {
    const result = await this.campaigns.adminPause(id);
    await this.adminAudit.log({
      admin,
      action: "campaign.paused",
      resourceType: "Campaign",
      resourceId: id,
      ipAddress: request.ip,
    });
    return result;
  }

  @Post("campaigns/:id/cancel")
  async cancelCampaign(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ) {
    const result = await this.campaigns.adminCancel(id);
    await this.adminAudit.log({
      admin,
      action: "campaign.cancelled",
      resourceType: "Campaign",
      resourceId: id,
      ipAddress: request.ip,
    });
    return result;
  }

  @Get("workflow-templates")
  workflowTemplateLibrary() {
    return this.workflowTemplates.adminList();
  }

  @Patch("workflow-templates/:id/status")
  async setWorkflowTemplateStatus(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { enabled: boolean },
    @Req() request: FastifyRequest,
  ) {
    const result = await this.workflowTemplates.adminSetEnabled(id, body.enabled);
    await this.adminAudit.log({
      admin,
      action: body.enabled ? "workflow_template.enabled" : "workflow_template.disabled",
      resourceType: "WorkflowTemplate",
      resourceId: id,
      ipAddress: request.ip,
    });
    return result;
  }

  @Post("workflow-templates")
  async createWorkflowTemplate(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body()
    body: {
      name: string;
      description?: string;
      category: "LEAD" | "APPOINTMENT" | "REVIEW" | "QUOTE" | "CUSTOM";
      triggerType:
        | "NEW_LEAD"
        | "MISSED_APPOINTMENT"
        | "APPOINTMENT_COMPLETED"
        | "NO_RESPONSE"
        | "UPCOMING_APPOINTMENT"
        | "QUOTE_SENT";
      configuration: Record<string, unknown>;
      estimatedConversionImpact: number;
    },
    @Req() request: FastifyRequest,
  ) {
    const result = await this.workflowTemplates.adminCreate({
      ...body,
      configuration: body.configuration as never,
    });
    await this.adminAudit.log({
      admin,
      action: "workflow_template.created",
      resourceType: "WorkflowTemplate",
      resourceId: result.id,
      ipAddress: request.ip,
    });
    return result;
  }

  @Patch("automations/workflows/:id/disable")
  async disableAutomation(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ) {
    const result = await this.automations.adminDisableWorkflow(id);
    await this.adminAudit.log({
      admin,
      action: "automation.workflow_disabled",
      resourceType: "AutomationWorkflow",
      resourceId: id,
      ipAddress: request.ip,
    });
    return result;
  }

  @Get("organizations")
  organizations(@Query() query: AdminListQueryDto) {
    return this.admin.organizations(query);
  }

  @Get("customers")
  customers(@Query() query: AdminListQueryDto) {
    return this.admin.customers(query);
  }

  @Get("customers/:id/timeline")
  customerTimeline(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: { cursor?: string; limit?: string },
  ) {
    return this.admin.customerTimeline(id, {
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get("customers/:id/memory-context")
  customerMemoryContext(@Param("id", ParseUUIDPipe) id: string) {
    return this.customerMemory.buildForAdmin(id);
  }

  @Get("customers/:id/greeting-preview")
  async customerGreetingPreview(@Param("id", ParseUUIDPipe) id: string) {
    const memory = await this.customerMemory.buildForAdmin(id);
    return this.greetings.build({
      organizationId: memory.customer.organizationId,
      interactionId: `admin:greeting:${id}`,
      channel: "ADMIN",
      memory,
      track: false,
    });
  }

  @Get("customer-memory-events")
  customerMemoryEvents(@Query("limit") limit?: string) {
    return this.customerMemory.recognitionEvents(limit ? Number(limit) : undefined);
  }

  @Get("organizations/:id")
  organization(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.organizationDetails(id);
  }

  @Patch("organizations/:id/status")
  setOrganizationStatus(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AdminStatusDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.setOrganizationStatus(admin, id, body, request.ip);
  }

  @Patch("organizations/:id/localization")
  setOrganizationLocalization(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AdminOrganizationLocalizationDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.setOrganizationLocalization(admin, id, body, request.ip);
  }

  @Delete("organizations/:id")
  deleteOrganization(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: DeleteConfirmDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.deleteOrganization(admin, id, body, request.ip);
  }

  @Get("users")
  users(@Query() query: AdminListQueryDto) {
    return this.admin.users(query);
  }

  @Patch("users/:id/status")
  setUserStatus(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UserStatusDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.setUserStatus(admin, id, body, request.ip);
  }

  @Post("users/:id/reset-password")
  resetUserPassword(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ResetUserPasswordDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.resetUserPassword(admin, id, body, request.ip);
  }

  @Get("agents")
  agents(@Query() query: AdminListQueryDto) {
    return this.admin.agents(query);
  }

  @Patch("agents/:id/status")
  setAgentStatus(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AgentStatusDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.setAgentStatus(admin, id, body, request.ip);
  }

  @Get("calls")
  calls(@Query() query: AdminListQueryDto) {
    return this.admin.calls(query);
  }

  @Get("outbound-calls")
  outboundCalls(@Query() query: AdminListQueryDto) {
    return this.admin.outboundCalls(query);
  }

  @Get("call-summaries")
  callSummaries(@Query() query: AdminListQueryDto & { sentiment?: string; outcome?: string }) {
    return this.admin.callSummaries(query);
  }

  @Get("phone-numbers")
  phoneNumbers(@Query() query: AdminListQueryDto) {
    return this.admin.phoneNumbers(query);
  }

  @Get("external-numbers")
  externalNumbers(@Query() query: AdminListQueryDto) {
    return this.admin.externalNumbers(query);
  }

  @Get("port-requests")
  portRequests() {
    return this.admin.portRequests();
  }

  @Get("port-requests/:id")
  portRequest(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.portRequest(id);
  }

  @Get("port-requests/:id/loa/download")
  portRequestLoa(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.portRequestLoa(id);
  }

  @Patch("port-requests/:id")
  updatePortRequest(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AdminUpdatePortRequestDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.updatePortRequest(admin, id, body, request.ip);
  }

  @Post("external-numbers/:id/disable")
  disableExternalNumber(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.disableExternalNumber(admin, id, request.ip);
  }

  @Post("external-numbers/:id/assign-agent")
  assignExternalNumber(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AdminAssignExternalNumberDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.assignExternalNumber(admin, id, body.agentId ?? null, request.ip);
  }

  @Get("subscriptions")
  subscriptions(@Query() query: AdminListQueryDto) {
    return this.admin.subscriptions(query);
  }

  @Post("subscriptions/:organizationId/change-plan")
  changePlan(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: AdminPlanOverrideDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.changePlan(admin, organizationId, body, request.ip);
  }

  @Post("subscriptions/:organizationId/override")
  override(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: AdminFeatureOverrideDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.applyOverride(admin, organizationId, body, request.ip);
  }

  @Post("subscriptions/:organizationId/cancel")
  cancelSubscription(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: AdminCancelSubscriptionDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.cancelSubscription(admin, organizationId, body, request.ip);
  }

  @Post("subscriptions/:organizationId/resume")
  resumeSubscription(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: AdminResumeSubscriptionDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.resumeSubscription(admin, organizationId, body.reason, request.ip);
  }

  @Post("subscriptions/:organizationId/grant-trial")
  grantTrial(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: GrantTrialDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.grantTrial(admin, organizationId, body, request.ip);
  }

  @Get("payments")
  payments(@Query() query: AdminListQueryDto) {
    return this.admin.payments(query);
  }

  @Get("knowledge-bases")
  knowledgeBases(@Query() query: AdminListQueryDto) {
    return this.admin.knowledgeBases(query);
  }

  @Get("documents")
  documents(@Query() query: AdminListQueryDto) {
    return this.admin.documents(query);
  }

  @Delete("documents/:id")
  deleteDocument(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: DeleteConfirmDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.deleteDocument(admin, id, body, request.ip);
  }

  @Get("tickets")
  tickets(@Query() query: AdminListQueryDto) {
    return this.admin.tickets(query);
  }

  @Post("tickets")
  createTicket(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() body: CreateSupportTicketDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.createTicket(admin, body, request.ip);
  }

  @Patch("tickets/:id")
  updateTicket(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateSupportTicketDto,
    @Req() request: FastifyRequest,
  ) {
    return this.admin.updateTicket(admin, id, body, request.ip);
  }

  @Get("audit-logs")
  auditLogs(@Query() query: AdminListQueryDto) {
    return this.admin.auditLogs(query);
  }

  @Get("search")
  search(@Query("q") q = "") {
    return this.admin.search(q);
  }
}
