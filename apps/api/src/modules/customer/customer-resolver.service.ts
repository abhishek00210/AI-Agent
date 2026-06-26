import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CustomerLeadStatus } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { UsageService } from "../usage/usage.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { normalizeE164 } from "../voice/e164";
import type { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";

type Interaction = "CALL" | "APPOINTMENT" | "CONVERSATION" | "MESSAGE" | "AI" | "PROFILE";

@Injectable()
export class CustomerResolverService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, @Optional() private readonly usage?: UsageService, @Optional() private readonly timeline?: CustomerTimelineService, @Optional() private readonly customerMemory?: CustomerMemoryContextService) {}

  async findByPhone(organizationId: string, value: string) {
    const phone = normalizePhone(value);
    if (!phone) return null;
    return this.cached(organizationId, `phone:${phone}`, () => this.prisma.customerProfile.findFirst({ where: { organizationId, phone }, include: { contact: true } }));
  }

  async findByEmail(organizationId: string, value: string) {
    const email = normalizeEmail(value);
    if (!email) return null;
    return this.cached(organizationId, `email:${email}`, () => this.prisma.customerProfile.findFirst({ where: { organizationId, email }, include: { contact: true } }));
  }

  async resolveCustomer(input: { organizationId: string; contactId?: string; name?: string; phone?: string | null; email?: string | null; company?: string | null; notes?: string | null; interaction?: Interaction; leadStatus?: CustomerLeadStatus }) {
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    let profile = phone ? await this.findByPhone(input.organizationId, phone) : null;
    profile ??= email ? await this.findByEmail(input.organizationId, email) : null;
    if (!profile && input.contactId) profile = await this.prisma.customerProfile.findFirst({ where: { organizationId: input.organizationId, contactId: input.contactId }, include: { contact: true } });
    if (profile) return this.touch(profile.id, input);
    let contact = input.contactId ? await this.prisma.contact.findFirst({ where: { id: input.contactId, organizationId: input.organizationId, deletedAt: null } }) : null;
    if (input.contactId && !contact) throw new NotFoundException("Contact not found.");
    if (!contact) {
      if (!phone && !email) throw new BadRequestException("Customer requires a phone number or email.");
      contact = await this.prisma.contact.create({ data: { organizationId: input.organizationId, name: input.name?.trim() || phone || email!, phone, email, company: input.company?.trim() || null, notes: input.notes?.trim() || null } });
    }
    try {
      const created = await this.prisma.customerProfile.create({ data: { organizationId: input.organizationId, contactId: contact.id, name: input.name?.trim() || contact.name, phone: phone ?? contact.phone, email: email ?? contact.email, company: input.company?.trim() || contact.company, notes: input.notes?.trim() || contact.notes, leadStatus: input.leadStatus ?? (input.interaction === "APPOINTMENT" ? "BOOKED" : "NEW"), lastContactAt: new Date(), ...initialMetrics(input.interaction) }, include: { contact: true } });
      await Promise.all([this.invalidate(input.organizationId, phone, email), this.audit(input.organizationId, "customer.created", created.id), this.usage?.increment({ organizationId: input.organizationId, resourceType: "CUSTOMER_PROFILES_CREATED", idempotencyKey: `customer:created:${created.id}` })]);
      await this.timeline?.recordEvent({ organizationId: input.organizationId, customerProfileId: created.id, eventType: "CUSTOMER_CREATED", sourceEntityType: "Contact", sourceEntityId: contact.id, idempotencyKey: `customer:created:${created.id}`, description: "Customer profile created." });
      return created;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const raced = (phone ? await this.findByPhone(input.organizationId, phone) : null) ?? (email ? await this.findByEmail(input.organizationId, email) : null);
      if (!raced) throw new ConflictException("Customer identity conflicts with another contact.");
      return this.touch(raced.id, input);
    }
  }

  upsertCustomer(input: Parameters<CustomerResolverService["resolveCustomer"]>[0]) { return this.resolveCustomer(input); }

  async touch(id: string, input: Parameters<CustomerResolverService["resolveCustomer"]>[0]) {
    const current = await this.prisma.customerProfile.findFirst({ where: { id, organizationId: input.organizationId } });
    if (!current) throw new NotFoundException("Customer not found.");
    const phone = normalizePhone(input.phone) ?? current.phone;
    const email = normalizeEmail(input.email) ?? current.email;
    const updated = await this.prisma.customerProfile.update({ where: { id }, data: { name: input.name?.trim() || current.name, phone, email, company: input.company?.trim() || current.company, notes: input.notes?.trim() || current.notes, leadStatus: input.leadStatus ?? current.leadStatus, lastContactAt: new Date(), lastSeenAt: new Date(), ...increments(input.interaction) }, include: { contact: true } });
    await this.prisma.contact.update({ where: { id: current.contactId }, data: { name: updated.name, phone: updated.phone, email: updated.email, company: updated.company, notes: updated.notes } });
    await Promise.all([this.invalidate(input.organizationId, phone, email), this.customerMemory?.invalidateCustomer(input.organizationId, id), this.audit(input.organizationId, input.leadStatus && input.leadStatus !== current.leadStatus ? "customer.lead_status_changed" : "customer.updated", id), this.usage?.increment({ organizationId: input.organizationId, resourceType: "CUSTOMER_PROFILES_UPDATED", idempotencyKey: `customer:updated:${id}:${input.interaction ?? "PROFILE"}:${Date.now()}` })]);
    return updated;
  }

  async list(organizationId: string, search?: string) {
    return this.prisma.customerProfile.findMany({
      where: { organizationId, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { company: { contains: search, mode: "insensitive" } }] } : {}) },
      orderBy: { lastContactAt: "desc" }, take: 100,
    });
  }
  async get(organizationId: string, id: string) {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { id, organizationId },
      include: { contact: { include: { leads: { where: { deletedAt: null } }, appointments: { orderBy: { startTime: "desc" }, take: 20 }, communicationThreads: { include: { messages: { orderBy: { createdAt: "desc" }, take: 50 } } } } } },
    });
    if (!profile) throw new NotFoundException("Customer not found.");
    return profile;
  }
  create(organizationId: string, input: CreateCustomerDto) { return this.resolveCustomer({ organizationId, ...input }); }
  update(organizationId: string, id: string, input: UpdateCustomerDto) { return this.touch(id, { organizationId, ...input }); }

  private async cached<T>(org: string, suffix: string, load: () => Promise<T>) { const key = `customer:v1:${org}:${suffix}`; if (this.redis.isAvailable) try { const value = await this.redis.cache.get(key); if (value) return JSON.parse(value) as T; } catch { void 0; } const result = await load(); if (this.redis.isAvailable) try { await this.redis.cache.set(key, JSON.stringify(result), "EX", 300); } catch { void 0; } return result; }
  private async invalidate(org: string, phone?: string | null, email?: string | null) { if (!this.redis.isAvailable) return; const keys = [phone && `customer:v1:${org}:phone:${phone}`, email && `customer:v1:${org}:email:${email}`].filter(Boolean) as string[]; if (keys.length) await this.redis.cache.del(...keys).catch(() => 0); }
  private audit(organizationId: string, action: string, entityId: string) { return this.prisma.auditEvent.create({ data: { organizationId, action, entityType: "CustomerProfile", entityId } }); }
}

function normalizePhone(value?: string | null) { if (!value?.trim()) return null; try { return normalizeE164(value); } catch { return null; } }
function normalizeEmail(value?: string | null) { return value?.trim().toLowerCase() || null; }
function increments(value?: Interaction) { return value === "CALL" ? { totalCalls: { increment: 1 } } : value === "APPOINTMENT" ? { totalAppointments: { increment: 1 }, leadStatus: "BOOKED" as const } : value === "CONVERSATION" ? { totalConversations: { increment: 1 } } : value === "MESSAGE" ? { totalMessages: { increment: 1 } } : value === "AI" ? { totalAiInteractions: { increment: 1 } } : {}; }
function initialMetrics(value?: Interaction) { return value === "CALL" ? { totalCalls: 1 } : value === "APPOINTMENT" ? { totalAppointments: 1 } : value === "CONVERSATION" ? { totalConversations: 1 } : value === "MESSAGE" ? { totalMessages: 1 } : value === "AI" ? { totalAiInteractions: 1 } : {}; }
