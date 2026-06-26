import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CommunicationChannel, LeadSource, LeadStatus, Prisma, TimelineEventType } from "../../../generated/prisma";
import { CommunicationThreadService } from "../communication/communication-thread.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import type { TenantContext } from "../tenant/tenant.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { AutomationEngineService } from "../automation/automation-engine.service";
import { OrganizationLocaleService } from "../organization-locale/organization-locale.service";
import { ContactResolver } from "./contact-resolver.service";
import type { CreateLeadDto, UpdateLeadDto } from "./dto/lead.dto";
import { normalizeLeadEmail, normalizeLeadPhone, splitContactName } from "./lead-normalization";
import { LeadTimelineService } from "./lead-timeline.service";
import { LeadRepository } from "./repositories/lead.repository";

export interface CaptureLeadInput {
  conversationId?: string;
  callId?: string;
  agentId?: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  address?: string;
  notes?: string;
  source?: string;
  status?: LeadStatus;
  countryCode?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

@Injectable()
export class LeadService {
  constructor(
    private readonly repository: LeadRepository,
    private readonly contacts: ContactResolver,
    private readonly timeline: LeadTimelineService,
    private readonly communicationThreads: CommunicationThreadService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly customerTimeline?: CustomerTimelineService,
    @Optional() private readonly automations?: AutomationEngineService,
    @Optional() private readonly locales?: OrganizationLocaleService,
  ) {}

  async create(context: TenantContext, input: CreateLeadDto) {
    if (input.assignedAgentId) await this.assertAgent(context.organizationId, input.assignedAgentId);
    const result = await this.capture(context, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      company: input.company,
      address: input.address,
      notes: input.notes,
      source: input.source ?? "MANUAL",
      status: input.status,
      agentId: input.assignedAgentId,
      countryCode: input.countryCode,
      tags: input.tags,
      customFields: input.customFields,
    });
    await this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: "lead.created", entityType: "Lead", entityId: result.lead.id });
    return result.lead;
  }

  async capture(context: TenantContext, input: CaptureLeadInput) {
    const source = normalizeLeadSource(input.source);
    const countryCode =
      input.countryCode ?? (await this.locales?.getPhoneRegion(context.organizationId));
    const metadata = { latestSource: source, customFields: input.customFields ?? {}, address: input.address ?? null } as Prisma.InputJsonObject;
    const contact = await this.contacts.resolve({
      organizationId: context.organizationId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      company: input.company,
      notes: input.notes,
      countryCode,
      tags: input.tags,
      metadata: { source, customFields: input.customFields ?? {}, address: input.address ?? null } as Prisma.InputJsonObject,
    });
    let lead = await this.repository.upsertLead({
      organizationId: context.organizationId,
      contactId: contact.id,
      conversationId: input.conversationId,
      callId: input.callId,
      agentId: input.agentId,
      source,
      notes: input.notes,
      scoreDelta: scoreForSource(source),
      metadata,
    });
    if (input.status || input.agentId) {
      lead = await this.repository.updateLead({
        organizationId: context.organizationId,
        leadId: lead.id,
        contact: {},
        status: input.status,
        agentId: input.agentId,
        notes: input.notes,
        metadata,
      }) ?? lead;
    }
    const event = await this.timeline.create({
      organizationId: context.organizationId,
      leadId: lead.id,
      type: timelineTypeForSource(source),
      title: titleForSource(source),
      description: input.notes,
      referenceType: input.callId ? "Call" : input.conversationId ? "Conversation" : "ToolExecution",
      referenceId: input.callId ?? input.conversationId ?? null,
      metadata: { source, agentId: input.agentId ?? null, conversationId: input.conversationId ?? null, callId: input.callId ?? null } satisfies Prisma.InputJsonValue,
    });
    await this.communicationThreads.recordMessage({ organizationId: context.organizationId, contactId: contact.id, channel: communicationChannelForSource(source), direction: "INBOUND" });
    await this.analytics?.record({ organizationId: context.organizationId, eventType: "LEAD_CREATED", idempotencyKey: `lead:created:${lead.id}`, agentId: input.agentId, metadata: { source, agentName: undefined } });
    await this.customerTimeline?.recordEvent({ organizationId: context.organizationId, contactId: contact.id, eventType: source === "IMPORT" ? "LEAD_IMPORTED" : "LEAD_CREATED", sourceEntityType: "Lead", sourceEntityId: lead.id, idempotencyKey: `lead:${source.toLowerCase()}:${lead.id}`, description: input.notes ?? `${input.name} became a lead.` });
    const reason = input.notes?.trim() || `New lead ${contact.name} requested information through ${source.toLowerCase().replaceAll("_", " ")}.`;
    await Promise.all([
      this.automations?.trigger({ organizationId: context.organizationId, triggerType: "NEW_LEAD", contactId: contact.id, sourceEntityType: "Lead", sourceEntityId: lead.id, reasonType: "LEAD_FOLLOW_UP", followUpReason: reason, reasonDescription: reason, metadata: { source, agentId: input.agentId ?? null } }),
      this.automations?.trigger({ organizationId: context.organizationId, triggerType: "NO_RESPONSE", contactId: contact.id, sourceEntityType: "Lead", sourceEntityId: lead.id, reasonType: "REACTIVATION", followUpReason: `No response received after lead capture. ${reason}`, reasonDescription: `No response received after lead capture. ${reason}`, metadata: { source, agentId: input.agentId ?? null } }),
    ]);
    return { contact, lead, timelineEvent: event };
  }

  async list(context: TenantContext, query: { limit?: number; cursor?: string; status?: LeadStatus; source?: LeadSource; search?: string; includeDeleted?: boolean }) {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const data = await this.repository.listLeads({ organizationId: context.organizationId, limit, cursor: query.cursor, status: query.status, source: query.source, search: query.search?.trim() || undefined, includeDeleted: query.includeDeleted });
    return { data, nextCursor: data.length === limit ? (data[data.length - 1]?.id ?? null) : null };
  }

  async getById(context: TenantContext, leadId: string) {
    const lead = await this.repository.findLeadById(context.organizationId, leadId);
    if (!lead) throw new NotFoundException("Lead not found.");
    return lead;
  }

  async update(context: TenantContext, leadId: string, input: UpdateLeadDto) {
    const current = await this.getById(context, leadId);
    if (input.assignedAgentId) await this.assertAgent(context.organizationId, input.assignedAgentId);
    const countryCode =
      input.countryCode ?? (await this.locales?.getPhoneRegion(context.organizationId));
    const phone = input.phone !== undefined ? normalizeLeadPhone(input.phone, countryCode) : undefined;
    const email = input.email !== undefined ? normalizeLeadEmail(input.email) : undefined;
    if (phone || email) {
      const duplicate = await this.repository.findContactByPhoneOrEmail(context.organizationId, phone, email);
      if (duplicate && duplicate.id !== current.contactId) throw new BadRequestException("Another lead/contact already uses that phone or email.");
    }
    const split = input.name ? splitContactName(input.name) : { firstName: undefined, lastName: undefined };
    const metadata = { customFields: input.customFields ?? {}, address: input.address ?? null } as Prisma.InputJsonObject;
    const updated = await this.repository.updateLead({
      organizationId: context.organizationId,
      leadId,
      contact: {
        ...(input.name !== undefined ? { name: input.name.trim(), firstName: split.firstName, lastName: split.lastName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(input.company !== undefined ? { company: input.company?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.customFields !== undefined || input.address !== undefined ? { metadata } : {}),
      },
      status: input.status,
      agentId: input.assignedAgentId,
      notes: input.notes,
      metadata,
    });
    if (!updated) throw new NotFoundException("Lead not found.");
    await Promise.all([
      this.customerTimeline?.recordEvent({ organizationId: context.organizationId, contactId: updated.contactId, eventType: current.status !== updated.status ? "LEAD_STATUS_CHANGED" : "LEAD_UPDATED", sourceEntityType: "Lead", sourceEntityId: updated.id, idempotencyKey: `lead:updated:${updated.id}:${Date.now()}`, description: "Lead updated." }),
      this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: "lead.updated", entityType: "Lead", entityId: updated.id }),
    ]);
    return updated;
  }

  async delete(context: TenantContext, leadId: string) {
    const lead = await this.getById(context, leadId);
    const deleted = await this.repository.softDeleteLead(context.organizationId, leadId, context.userId);
    await Promise.all([
      this.customerTimeline?.recordEvent({ organizationId: context.organizationId, contactId: lead.contactId, eventType: "LEAD_DELETED", sourceEntityType: "Lead", sourceEntityId: lead.id, idempotencyKey: `lead:deleted:${lead.id}:${Date.now()}`, description: "Lead soft deleted." }),
      this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: "lead.deleted", entityType: "Lead", entityId: lead.id }),
    ]);
    return deleted;
  }

  async restore(context: TenantContext, leadId: string) {
    const existing = await this.repository.findLeadByIdIncludingDeleted(context.organizationId, leadId);
    if (!existing) throw new NotFoundException("Lead not found.");
    const restored = await this.repository.restoreLead(context.organizationId, leadId);
    await Promise.all([
      this.customerTimeline?.recordEvent({ organizationId: context.organizationId, contactId: restored.contactId, eventType: "LEAD_RESTORED", sourceEntityType: "Lead", sourceEntityId: restored.id, idempotencyKey: `lead:restored:${restored.id}:${Date.now()}`, description: "Lead restored." }),
      this.repository.createAuditEvent({ organizationId: context.organizationId, actorUserId: context.userId, action: "lead.restored", entityType: "Lead", entityId: restored.id }),
    ]);
    return restored;
  }

  async listContacts(context: TenantContext, query: { limit?: number; cursor?: string; search?: string }) {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const data = await this.repository.listContacts({ organizationId: context.organizationId, limit, cursor: query.cursor, search: query.search?.trim() || undefined });
    return { data, nextCursor: data.length === limit ? (data[data.length - 1]?.id ?? null) : null };
  }

  async getContactById(context: TenantContext, contactId: string) {
    const contact = await this.repository.findContactById(context.organizationId, contactId);
    if (!contact) throw new NotFoundException("Contact not found.");
    return contact;
  }

  private async assertAgent(organizationId: string, agentId: string) {
    const agent = await this.repository.agentExists(organizationId, agentId);
    if (!agent) throw new BadRequestException("Assigned agent is not available in this organization.");
  }
}

export function normalizeLeadSource(value?: string | null): LeadSource {
  if (value === "VOICE") return "VOICE";
  if (value === "WIDGET") return "WIDGET";
  if (value === "CHAT") return "CHAT";
  if (value === "MANUAL") return "MANUAL";
  if (value === "IMPORT") return "IMPORT";
  return "AI_AGENT";
}
function timelineTypeForSource(source: LeadSource): TimelineEventType { return source === "VOICE" ? "CALL" : source === "WIDGET" || source === "CHAT" ? "CHAT" : "NOTE"; }
function titleForSource(source: LeadSource) { return source === "VOICE" ? "Voice lead captured" : source === "WIDGET" ? "Widget lead captured" : source === "CHAT" ? "Chat lead captured" : "Lead captured"; }
function scoreForSource(source: LeadSource) { return source === "VOICE" ? 20 : source === "CHAT" || source === "WIDGET" ? 15 : 5; }
function communicationChannelForSource(source: LeadSource): CommunicationChannel { return source === "VOICE" ? "VOICE" : source === "WIDGET" || source === "CHAT" ? "WEB_CHAT" : "EMAIL"; }
