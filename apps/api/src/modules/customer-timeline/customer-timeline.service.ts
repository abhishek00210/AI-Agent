import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CustomerTimelineCategory, CustomerTimelineEventType, Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { UsageService } from "../usage/usage.service";
import { TimelineEventFactory } from "./timeline-event.factory";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";

@Injectable()
export class CustomerTimelineService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly factory: TimelineEventFactory, @Optional() private readonly usage?: UsageService, @Optional() private readonly customerMemory?: CustomerMemoryContextService) {}

  async recordEvent(input: { organizationId: string; customerProfileId?: string; contactId?: string; phone?: string | null; email?: string | null; eventType: CustomerTimelineEventType; description?: string | null; sourceEntityType?: string; sourceEntityId?: string; idempotencyKey: string; metadata?: Prisma.InputJsonValue; occurredAt?: Date }) {
    const customer = await this.resolve(input);
    if (!customer) return null;
    const built = this.factory.create(input.eventType, input.description);
    const event = await this.createOnce({
      organizationId: input.organizationId,
      customerProfileId: customer.id,
      ...built,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
    if (!event.created) return event.row;
    await Promise.all([this.bumpVersion(input.organizationId, customer.id), this.customerMemory?.invalidateCustomer(input.organizationId, customer.id), this.prisma.auditEvent.create({ data: { organizationId: input.organizationId, action: "customer_timeline.created", entityType: "CustomerTimelineEvent", entityId: event.row.id, metadata: { eventType: event.row.eventType } } }), this.usage?.increment({ organizationId: input.organizationId, resourceType: "TIMELINE_WRITES", idempotencyKey: `timeline:write:${event.row.id}` })]);
    return event.row;
  }

  getTimeline(organizationId: string, customerProfileId: string, input: { cursor?: string; limit?: number; category?: CustomerTimelineCategory; eventType?: CustomerTimelineEventType }) { return this.getTimelinePage(organizationId, customerProfileId, input); }
  getCustomerFeed(organizationId: string, customerProfileId: string, input: { cursor?: string; limit?: number; category?: CustomerTimelineCategory }) { return this.getTimelinePage(organizationId, customerProfileId, input); }
  async getTimelinePage(organizationId: string, customerProfileId: string, input: { cursor?: string; limit?: number; category?: CustomerTimelineCategory; eventType?: CustomerTimelineEventType }) {
    const customer = await this.prisma.customerProfile.findFirst({ where: { id: customerProfileId, organizationId }, select: { id: true } });
    if (!customer) throw new NotFoundException("Customer not found.");
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const version = await this.version(organizationId, customerProfileId);
    const cacheKey = `timeline:v1:${organizationId}:${customerProfileId}:${version}:${input.category ?? "ALL"}:${input.eventType ?? "ALL"}:${input.cursor ?? "FIRST"}:${limit}`;
    if (this.redis.isAvailable) try { const cached = await this.redis.cache.get(cacheKey); if (cached) return JSON.parse(cached); } catch { void 0; }
    const rows = await this.prisma.customerTimelineEvent.findMany({ where: { organizationId, customerProfileId, ...(input.category ? { eventCategory: input.category } : {}), ...(input.eventType ? { eventType: input.eventType } : {}), ...(cursor ? { OR: [{ occurredAt: { lt: cursor.occurredAt } }, { occurredAt: cursor.occurredAt, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: limit + 1 });
    const hasMore = rows.length > limit; const data = rows.slice(0, limit); const last = data.at(-1);
    const result = { data, nextCursor: hasMore && last ? encodeCursor(last.occurredAt, last.id) : null };
    if (this.redis.isAvailable) try { await this.redis.cache.set(cacheKey, JSON.stringify(result), "EX", 300); } catch { void 0; }
    await this.usage?.increment({ organizationId, resourceType: "TIMELINE_READS", idempotencyKey: `timeline:read:${customerProfileId}:${Date.now()}` });
    return result;
  }
  private resolve(input: { organizationId: string; customerProfileId?: string; contactId?: string; phone?: string | null; email?: string | null }) { return this.prisma.customerProfile.findFirst({ where: { organizationId: input.organizationId, OR: [input.customerProfileId ? { id: input.customerProfileId } : undefined, input.contactId ? { contactId: input.contactId } : undefined, input.phone ? { phone: input.phone } : undefined, input.email ? { email: input.email.toLowerCase() } : undefined].filter(Boolean) as Prisma.CustomerProfileWhereInput[] }, select: { id: true } }); }
  private async version(org: string, customer: string) { if (!this.redis.isAvailable) return "0"; try { return (await this.redis.cache.get(`timeline:version:${org}:${customer}`)) ?? "0"; } catch { return "0"; } }
  private async bumpVersion(org: string, customer: string) { if (!this.redis.isAvailable) return; await this.redis.cache.incr(`timeline:version:${org}:${customer}`).catch(() => 0); }
  private async createOnce(data: Prisma.CustomerTimelineEventUncheckedCreateInput) {
    try {
      return { created: true, row: await this.prisma.customerTimelineEvent.create({ data }) };
    } catch (error) {
      if (isUniqueConstraint(error)) {
        const row = await this.prisma.customerTimelineEvent.findUniqueOrThrow({
          where: {
            organizationId_idempotencyKey: {
              organizationId: data.organizationId,
              idempotencyKey: data.idempotencyKey,
            },
          },
        });
        return { created: false, row };
      }
      throw error;
    }
  }
}
function encodeCursor(occurredAt: Date, id: string) { return Buffer.from(JSON.stringify({ occurredAt: occurredAt.toISOString(), id })).toString("base64url"); }
function decodeCursor(value: string) { try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as { occurredAt?: string; id?: string }; const occurredAt = new Date(parsed.occurredAt ?? ""); if (!parsed.id || Number.isNaN(occurredAt.getTime())) throw new Error(); return { occurredAt, id: parsed.id }; } catch { throw new BadRequestException("Invalid timeline cursor."); } }
function isUniqueConstraint(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}
