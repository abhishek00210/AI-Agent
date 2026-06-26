import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { TenantService } from "../tenant/tenant.service";
import { ConfirmLeadImportDto, CreateCampaignFromLeadImportDto, CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from "./dto/lead.dto";
import { LeadImportService } from "./lead-import.service";
import { LeadService } from "./lead.service";

@UseGuards(JwtAuthGuard)
@Controller()
export class LeadController {
  constructor(
    private readonly leads: LeadService,
    private readonly imports: LeadImportService,
    private readonly tenant: TenantService,
  ) {}

  @Post("leads")
  createLead(@CurrentUser() user: JwtPayload, @Body() body: CreateLeadDto) {
    return this.leads.create(this.tenant.fromUser(user), body);
  }

  @Get("leads")
  listLeads(@CurrentUser() user: JwtPayload, @Query() query: ListLeadsQueryDto) {
    return this.leads.list(this.tenant.fromUser(user), query);
  }

  @Get("leads/imports")
  listImports(@CurrentUser() user: JwtPayload, @Query("limit") limit?: string) {
    return this.imports.list(this.tenant.fromUser(user), limit ? Number(limit) : undefined);
  }

  @Post("leads/imports/upload")
  async uploadImport(@CurrentUser() user: JwtPayload, @Req() request: FastifyRequest) {
    const part = await request.file();
    const buffer = part ? await part.toBuffer() : undefined;
    return this.imports.uploadPreview(
      this.tenant.fromUser(user),
      part && buffer ? { originalname: part.filename, mimetype: part.mimetype, size: buffer.length, buffer } : undefined,
    );
  }

  @Get("leads/imports/:id")
  getImport(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string) {
    return this.imports.get(this.tenant.fromUser(user), id);
  }

  @Post("leads/imports/:id/confirm")
  confirmImport(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Body() body: ConfirmLeadImportDto) {
    return this.imports.confirm(this.tenant.fromUser(user), id, body.duplicateStrategy);
  }

  @Post("leads/imports/:id/create-campaign")
  createCampaignFromImport(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) id: string, @Body() body: CreateCampaignFromLeadImportDto) {
    return this.imports.createCampaign(this.tenant.fromUser(user), id, body);
  }

  @Get("leads/:id")
  getLead(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) leadId: string) {
    return this.leads.getById(this.tenant.fromUser(user), leadId);
  }

  @Patch("leads/:id")
  updateLead(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) leadId: string, @Body() body: UpdateLeadDto) {
    return this.leads.update(this.tenant.fromUser(user), leadId, body);
  }

  @Delete("leads/:id")
  deleteLead(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) leadId: string) {
    return this.leads.delete(this.tenant.fromUser(user), leadId);
  }

  @Post("leads/:id/restore")
  restoreLead(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) leadId: string) {
    return this.leads.restore(this.tenant.fromUser(user), leadId);
  }

  @Get("contacts")
  listContacts(@CurrentUser() user: JwtPayload, @Query() query: ListLeadsQueryDto) {
    return this.leads.listContacts(this.tenant.fromUser(user), query);
  }

  @Get("contacts/:id")
  getContact(@CurrentUser() user: JwtPayload, @Param("id", ParseUUIDPipe) contactId: string) {
    return this.leads.getContactById(this.tenant.fromUser(user), contactId);
  }
}
