import { Injectable } from "@nestjs/common";
import type {
  LeadSource,
  LeadStatus,
  Prisma,
  TimelineEventType,
} from "../../../../generated/prisma";
import { PrismaService } from "../../../database/prisma.service";

export interface ResolveContactInput {
  organizationId: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
  metadata?: Prisma.InputJsonValue;
}

export interface UpsertLeadInput {
  organizationId: string;
  contactId: string;
  conversationId?: string | null;
  callId?: string | null;
  agentId?: string | null;
  source: LeadSource;
  notes?: string | null;
  scoreDelta: number;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  findContactByPhoneOrEmail(organizationId: string, phone?: string | null, email?: string | null) {
    return this.prisma.contact.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
  }

  createContact(input: ResolveContactInput) {
    return this.prisma.contact.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        company: input.company,
        notes: input.notes,
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
      },
    });
  }

  updateContact(contactId: string, input: ResolveContactInput) {
    return this.prisma.contact.update({
      where: { id: contactId, organizationId: input.organizationId },
      data: {
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        company: input.company,
        notes: input.notes,
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
        deletedAt: null,
      },
    });
  }

  findLeadByContact(organizationId: string, contactId: string) {
    return this.prisma.lead.findUnique({
      where: { organizationId_contactId: { organizationId, contactId } },
      include: leadInclude,
    });
  }

  async upsertLead(input: UpsertLeadInput) {
    const existing = await this.findLeadByContact(input.organizationId, input.contactId);
    if (existing) {
      return this.prisma.lead.update({
        where: { id: existing.id, organizationId: input.organizationId },
        data: {
          conversationId: input.conversationId ?? existing.conversationId,
          callId: input.callId ?? existing.callId,
          agentId: input.agentId ?? existing.agentId,
          notes: input.notes ?? existing.notes,
          score: { increment: input.scoreDelta },
          lastInteractionAt: new Date(),
          metadata: input.metadata ?? (existing.metadata as Prisma.InputJsonValue),
          deletedAt: null,
        },
        include: leadInclude,
      });
    }

    return this.prisma.lead.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        conversationId: input.conversationId,
        callId: input.callId,
        agentId: input.agentId,
        source: input.source,
        notes: input.notes,
        score: input.scoreDelta,
        lastInteractionAt: new Date(),
        metadata: input.metadata ?? {},
      },
      include: leadInclude,
    });
  }

  createTimelineEvent(input: {
    organizationId: string;
    leadId: string;
    type: TimelineEventType;
    title: string;
    description?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.leadTimelineEvent.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        type: input.type,
        title: input.title,
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        metadata: input.metadata ?? {},
      },
    });
  }

  listLeads(options: {
    organizationId: string;
    limit: number;
    cursor?: string;
    status?: LeadStatus;
    source?: LeadSource;
    search?: string;
    includeDeleted?: boolean;
  }) {
    return this.prisma.lead.findMany({
      where: {
        organizationId: options.organizationId,
        ...(options.includeDeleted ? {} : { deletedAt: null }),
        ...(options.status ? { status: options.status } : {}),
        ...(options.source ? { source: options.source } : {}),
        ...(options.search
          ? {
              OR: [
                { contact: { name: { contains: options.search, mode: "insensitive" } } },
                { contact: { email: { contains: options.search, mode: "insensitive" } } },
                { contact: { phone: { contains: options.search, mode: "insensitive" } } },
                { contact: { company: { contains: options.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastInteractionAt: "desc" }, { id: "desc" }],
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      take: options.limit,
      include: leadInclude,
    });
  }

  findLeadById(organizationId: string, leadId: string) {
    return this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: {
        ...leadInclude,
        timelineEvents: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });
  }

  findLeadByIdIncludingDeleted(organizationId: string, leadId: string) {
    return this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: leadInclude,
    });
  }

  updateLead(input: {
    organizationId: string;
    leadId: string;
    contact: Partial<ResolveContactInput>;
    status?: LeadStatus;
    agentId?: string | null;
    notes?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: input.leadId, organizationId: input.organizationId, deletedAt: null }, include: { contact: true } });
      if (!lead) return null;
      const updatedContact = await tx.contact.update({
        where: { id: lead.contactId },
        data: {
          ...(input.contact.name !== undefined ? { name: input.contact.name } : {}),
          ...(input.contact.firstName !== undefined ? { firstName: input.contact.firstName } : {}),
          ...(input.contact.lastName !== undefined ? { lastName: input.contact.lastName } : {}),
          ...(input.contact.phone !== undefined ? { phone: input.contact.phone } : {}),
          ...(input.contact.email !== undefined ? { email: input.contact.email } : {}),
          ...(input.contact.company !== undefined ? { company: input.contact.company } : {}),
          ...(input.contact.notes !== undefined ? { notes: input.contact.notes } : {}),
          ...(input.contact.metadata !== undefined ? { metadata: input.contact.metadata } : {}),
          ...(Array.isArray((input.contact as { tags?: string[] }).tags) ? { tags: (input.contact as { tags: string[] }).tags } : {}),
        },
      });
      await tx.customerProfile.updateMany({
        where: { contactId: lead.contactId, organizationId: input.organizationId },
        data: {
          name: updatedContact.name,
          phone: updatedContact.phone,
          email: updatedContact.email,
          company: updatedContact.company,
          notes: updatedContact.notes,
          lastSeenAt: new Date(),
        },
      });
      return tx.lead.update({
        where: { id: input.leadId },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.metadata ? { metadata: input.metadata } : {}),
          lastInteractionAt: new Date(),
        },
        include: leadInclude,
      });
    });
  }

  listContacts(options: { organizationId: string; limit: number; cursor?: string; search?: string }) {
    return this.prisma.contact.findMany({
      where: {
        organizationId: options.organizationId,
        deletedAt: null,
        ...(options.search
          ? {
              OR: [
                { name: { contains: options.search, mode: "insensitive" } },
                { email: { contains: options.search, mode: "insensitive" } },
                { phone: { contains: options.search, mode: "insensitive" } },
                { company: { contains: options.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      take: options.limit,
    });
  }

  findContactById(organizationId: string, contactId: string) {
    return this.prisma.contact.findFirst({
      where: { id: contactId, organizationId, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null },
          orderBy: { lastInteractionAt: "desc" },
          take: 20,
        },
      },
    });
  }

  agentExists(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, deletedAt: null },
      select: { id: true },
    });
  }

  softDeleteLead(organizationId: string, leadId: string, deletedBy?: string | null) {
    return this.prisma.lead.update({
      where: { id: leadId, organizationId },
      data: { deletedAt: new Date(), deletedBy, status: "LOST" },
      include: leadInclude,
    });
  }

  restoreLead(organizationId: string, leadId: string) {
    return this.prisma.lead.update({
      where: { id: leadId, organizationId },
      data: { deletedAt: null, deletedBy: null },
      include: leadInclude,
    });
  }

  createLeadImport(input: {
    organizationId: string;
    createdBy?: string | null;
    fileName: string;
    fileSizeBytes: number;
    mapping: Prisma.InputJsonValue;
    previewRows: Prisma.InputJsonValue;
    failedRows: Prisma.InputJsonValue;
    duplicateRows: Prisma.InputJsonValue;
    rowsFound: number;
    rowsValid: number;
    rowsInvalid: number;
    rowsDuplicate: number;
  }) {
    return this.prisma.leadImport.create({
      data: {
        ...input,
        status: "PREVIEWED",
      },
    });
  }

  listLeadImports(organizationId: string, limit = 50) {
    return this.prisma.leadImport.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });
  }

  findLeadImport(organizationId: string, importId: string) {
    return this.prisma.leadImport.findFirst({
      where: { id: importId, organizationId },
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });
  }

  updateLeadImport(organizationId: string, importId: string, data: Prisma.LeadImportUpdateInput) {
    return this.prisma.leadImport.update({
      where: { id: importId, organizationId },
      data,
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });
  }

  createAuditEvent(input: {
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({ data: input });
  }
}

export const leadInclude = {
  contact: { include: { customerProfile: { select: { id: true, name: true, phone: true, email: true } } } },
  agent: { select: { id: true, name: true, status: true } },
  conversation: { select: { id: true, status: true, channel: true, source: true } },
  call: { select: { id: true, twilioCallSid: true, callerNumber: true, calledNumber: true } },
} satisfies Prisma.LeadInclude;
