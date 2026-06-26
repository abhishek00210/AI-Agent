import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { UsageService } from "../usage/usage.service";
import { PromptMemoryBuilder } from "./prompt-memory.builder";
import type {
  CustomerMemoryAppointment,
  CustomerMemoryContext,
  MemoryLoadInput,
} from "./customer-memory.types";

const CACHE_TTL_SECONDS = 300;
const SUMMARY_LIMIT = 5;
const TIMELINE_LIMIT = 10;
const APPOINTMENT_LIMIT = 3;

@Injectable()
export class CustomerMemoryContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly prompts: PromptMemoryBuilder,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  memoryPolicy() {
    return {
      recentSummaries: SUMMARY_LIMIT,
      recentTimelineEvents: TIMELINE_LIMIT,
      recentAppointments: APPOINTMENT_LIMIT,
      rawTranscriptsInjected: false,
    } as const;
  }

  async buildContext(input: MemoryLoadInput): Promise<CustomerMemoryContext> {
    const version = await this.cacheVersion(input.organizationId, input.customerProfileId);
    const key = `customer-memory:v1:${input.organizationId}:${input.customerProfileId}:${version}:${input.excludeCallId ?? "none"}`;
    const cached = await this.readCache(key);
    const context = cached ?? (await this.load(input));
    if (!cached) await this.writeCache(key, context);
    if (input.track !== false) void this.trackLoad(input, context).catch(() => undefined);
    return context;
  }

  async getCustomerMemory(input: MemoryLoadInput) {
    return this.buildContext(input);
  }

  getRecentSummaries(organizationId: string, customerProfileId: string, excludeCallId?: string) {
    return this.prisma.callSummary.findMany({
      where: {
        organizationId,
        customerProfileId,
        ...(excludeCallId ? { callId: { not: excludeCallId } } : {}),
      },
      select: {
        id: true,
        summary: true,
        intent: true,
        sentiment: true,
        outcome: true,
        nextAction: true,
        followUpRequired: true,
        confidenceScore: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: "desc" },
      take: SUMMARY_LIMIT,
    });
  }

  getRecentTimeline(organizationId: string, customerProfileId: string, excludeCallId?: string) {
    return this.prisma.customerTimelineEvent.findMany({
      where: {
        organizationId,
        customerProfileId,
        ...(excludeCallId
          ? { NOT: { sourceEntityType: "Call", sourceEntityId: excludeCallId } }
          : {}),
      },
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        occurredAt: true,
        sourceEntityType: true,
        sourceEntityId: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: TIMELINE_LIMIT,
    });
  }

  async getRecentAppointments(organizationId: string, contactId: string) {
    const now = new Date();
    const select = {
      id: true,
      title: true,
      status: true,
      startTime: true,
      endTime: true,
      timezone: true,
    } as const;
    const [upcoming, recent] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          organizationId,
          contactId,
          status: "CONFIRMED",
          startTime: { gte: now },
        },
        select,
        orderBy: { startTime: "asc" },
        take: 2,
      }),
      this.prisma.appointment.findMany({
        where: { organizationId, contactId, startTime: { lt: now } },
        select,
        orderBy: { startTime: "desc" },
        take: APPOINTMENT_LIMIT,
      }),
    ]);
    return uniqueAppointments([...upcoming, ...recent]).slice(0, APPOINTMENT_LIMIT);
  }

  async getOpenFollowUps(organizationId: string, customerProfileId: string) {
    const rows = await this.prisma.callSummary.findMany({
      where: {
        organizationId,
        customerProfileId,
        followUpRequired: true,
        nextAction: { not: null },
      },
      select: { id: true, nextAction: true, generatedAt: true },
      orderBy: { generatedAt: "desc" },
      take: 3,
    });
    return rows.map((row) => ({
      summaryId: row.id,
      action: row.nextAction!,
      generatedAt: row.generatedAt,
    }));
  }

  async findByPhone(organizationId: string, phone: string) {
    return this.prisma.customerProfile.findFirst({
      where: { organizationId, phone },
      select: { id: true },
    });
  }

  async findForConversation(organizationId: string, conversationId: string) {
    return this.prisma.customerProfile.findFirst({
      where: {
        organizationId,
        OR: [
          { callSummaries: { some: { organizationId, conversationId } } },
          { contact: { appointments: { some: { organizationId, conversationId } } } },
          { contact: { leads: { some: { organizationId, conversationId, deletedAt: null } } } },
        ],
      },
      select: { id: true },
    });
  }

  async buildForPhone(input: Omit<MemoryLoadInput, "customerProfileId"> & { phone: string }) {
    const customer = await this.findByPhone(input.organizationId, input.phone);
    if (!customer) return null;
    return this.buildContext({ ...input, customerProfileId: customer.id });
  }

  async buildForConversation(
    input: Omit<MemoryLoadInput, "customerProfileId"> & { conversationId: string },
  ) {
    const customer = await this.findForConversation(input.organizationId, input.conversationId);
    if (!customer) return null;
    return this.buildContext({ ...input, customerProfileId: customer.id });
  }

  async invalidateCustomer(organizationId: string, customerProfileId: string) {
    if (!this.redis.isAvailable) return;
    await this.redis.cache
      .incr(`customer-memory:version:${organizationId}:${customerProfileId}`)
      .catch(() => 0);
  }

  async invalidateForContact(organizationId: string, contactId: string) {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { organizationId, contactId },
      select: { id: true },
    });
    if (profile) await this.invalidateCustomer(organizationId, profile.id);
  }

  async recordPromptInjection(input: {
    organizationId: string;
    customerProfileId: string;
    interactionId: string;
    channel: MemoryLoadInput["channel"];
    personalizedGreeting?: boolean;
  }) {
    const writes: Promise<unknown>[] = [
      this.audit(input.organizationId, "customer_memory.prompt_injected", input.customerProfileId, {
        channel: input.channel,
      }),
    ];
    if (input.personalizedGreeting) {
      writes.push(
        this.audit(
          input.organizationId,
          "customer_memory.personalized_greeting",
          input.customerProfileId,
          { channel: input.channel },
        ),
      );
      if (this.analytics)
        writes.push(
          this.analytics.record({
            organizationId: input.organizationId,
            eventType: "PERSONALIZED_GREETING",
            idempotencyKey: `memory:greeting:${input.interactionId}`,
          }),
        );
    }
    await Promise.all(writes);
  }

  recognitionEvents(limit = 100) {
    return this.prisma.auditEvent.findMany({
      where: {
        action: {
          in: [
            "customer_memory.recognized",
            "customer_memory.context_built",
            "customer_memory.prompt_injected",
            "customer_memory.personalized_greeting",
          ],
        },
      },
      select: {
        id: true,
        organizationId: true,
        action: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 250),
    });
  }

  async buildForAdmin(customerProfileId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { id: true, organizationId: true },
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    return this.buildContext({
      organizationId: customer.organizationId,
      customerProfileId: customer.id,
      interactionId: `admin:${customer.id}`,
      channel: "ADMIN",
      track: false,
    });
  }

  private async load(input: MemoryLoadInput): Promise<CustomerMemoryContext> {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { id: input.customerProfileId, organizationId: input.organizationId },
      select: {
        id: true,
        organizationId: true,
        contactId: true,
        name: true,
        company: true,
        leadStatus: true,
        lastContactAt: true,
        totalCalls: true,
      },
    });
    if (!profile) throw new NotFoundException("Customer not found.");
    const [recentSummaries, recentTimeline, appointments, openFollowUps] = await Promise.all([
      this.getRecentSummaries(input.organizationId, profile.id, input.excludeCallId),
      this.getRecentTimeline(input.organizationId, profile.id, input.excludeCallId),
      this.getRecentAppointments(input.organizationId, profile.contactId),
      this.getOpenFollowUps(input.organizationId, profile.id),
    ]);
    const historicalTimeline = recentTimeline.filter(
      (event) => event.eventType !== "CUSTOMER_CREATED",
    );
    const recognized =
      profile.totalCalls > 1 ||
      recentSummaries.length > 0 ||
      appointments.length > 0 ||
      historicalTimeline.length > 0 ||
      profile.leadStatus !== "NEW";
    const base = {
      customer: profile,
      recognized,
      recognitionConfidence:
        recentSummaries.some((item) => item.confidenceScore >= 0.65) || profile.totalCalls > 1
          ? ("HIGH" as const)
          : ("MEDIUM" as const),
      recentSummaries,
      recentTimeline,
      appointments,
      openFollowUps,
    };
    const promptContext = recognized ? this.prompts.build(base) : "";
    return { ...base, promptContext, estimatedTokens: Math.ceil(promptContext.length / 4) };
  }

  private async trackLoad(input: MemoryLoadInput, context: CustomerMemoryContext) {
    const writes: Promise<unknown>[] = [
      this.audit(input.organizationId, "customer_memory.context_built", context.customer.id, {
        channel: input.channel,
        recognized: context.recognized,
        summaryCount: context.recentSummaries.length,
        timelineCount: context.recentTimeline.length,
        appointmentCount: context.appointments.length,
        estimatedTokens: context.estimatedTokens,
      }),
    ];
    if (this.usage) {
      writes.push(
        this.usage.increment({
          organizationId: input.organizationId,
          resourceType: "MEMORY_RETRIEVALS",
          idempotencyKey: `memory:retrieval:${input.channel}:${input.interactionId}`,
        }),
      );
      if (context.estimatedTokens > 0)
        writes.push(
          this.usage.increment({
            organizationId: input.organizationId,
            resourceType: "MEMORY_CONTEXT_TOKENS",
            quantity: context.estimatedTokens,
            idempotencyKey: `memory:tokens:${input.channel}:${input.interactionId}`,
          }),
        );
    }
    if (this.analytics)
      writes.push(
        this.analytics.record({
          organizationId: input.organizationId,
          eventType: "MEMORY_CONTEXT_LOADED",
          idempotencyKey: `memory:loaded:${input.channel}:${input.interactionId}`,
        }),
      );
    if (context.recognized) {
      writes.push(
        this.audit(input.organizationId, "customer_memory.recognized", context.customer.id, {
          channel: input.channel,
          confidence: context.recognitionConfidence,
        }),
      );
      if (this.analytics)
        writes.push(
          this.analytics.record({
            organizationId: input.organizationId,
            eventType: "CALLER_RECOGNIZED",
            idempotencyKey: `memory:recognized:${input.channel}:${input.interactionId}`,
          }),
        );
    }
    await Promise.all(writes);
  }

  private audit(
    organizationId: string,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditEvent.create({
      data: { organizationId, action, entityType: "CustomerMemory", entityId, metadata },
    });
  }

  private async cacheVersion(organizationId: string, customerProfileId: string) {
    if (!this.redis.isAvailable) return "0";
    return (
      (await this.redis.cache
        .get(`customer-memory:version:${organizationId}:${customerProfileId}`)
        .catch(() => null)) ?? "0"
    );
  }

  private async readCache(key: string): Promise<CustomerMemoryContext | null> {
    if (!this.redis.isAvailable) return null;
    const value = await this.redis.cache.get(key).catch(() => null);
    if (!value) return null;
    try {
      return hydrate(JSON.parse(value) as CustomerMemoryContext);
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, context: CustomerMemoryContext) {
    if (!this.redis.isAvailable) return;
    await this.redis.cache
      .set(key, JSON.stringify(context), "EX", CACHE_TTL_SECONDS)
      .catch(() => undefined);
  }
}

function uniqueAppointments(rows: CustomerMemoryAppointment[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function hydrate(value: CustomerMemoryContext): CustomerMemoryContext {
  return {
    ...value,
    customer: {
      ...value.customer,
      lastContactAt: value.customer.lastContactAt
        ? new Date(value.customer.lastContactAt)
        : null,
    },
    recentSummaries: value.recentSummaries.map((row) => ({
      ...row,
      generatedAt: new Date(row.generatedAt),
    })),
    recentTimeline: value.recentTimeline.map((row) => ({
      ...row,
      occurredAt: new Date(row.occurredAt),
    })),
    appointments: value.appointments.map((row) => ({
      ...row,
      startTime: new Date(row.startTime),
      endTime: new Date(row.endTime),
    })),
    openFollowUps: value.openFollowUps.map((row) => ({
      ...row,
      generatedAt: new Date(row.generatedAt),
    })),
  };
}
