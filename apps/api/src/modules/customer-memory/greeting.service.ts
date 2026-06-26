import { Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { UsageService } from "../usage/usage.service";
import { GreetingPolicyEngine } from "./greeting-policy.engine";
import type {
  CustomerMemoryContext,
  GreetingChannel,
  GreetingConfidenceThreshold,
  GreetingDecision,
  GreetingSettings,
} from "./customer-memory.types";

@Injectable()
export class GreetingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: GreetingPolicyEngine,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async build(input: {
    organizationId: string;
    interactionId: string;
    channel: GreetingChannel;
    memory: CustomerMemoryContext | null;
    track?: boolean;
  }): Promise<GreetingDecision> {
    const settings = await this.settings(input.organizationId);
    const decision = this.policy.decide(input.memory, settings);
    if (input.track !== false) void this.track(input, decision).catch(() => undefined);
    return decision;
  }

  async settings(organizationId: string): Promise<GreetingSettings> {
    const row = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        personalizedGreetingsEnabled: true,
        greetingRecencyWindowDays: true,
        greetingConfidenceThreshold: true,
      },
    });
    if (!row) return this.policy.defaultSettings();
    return {
      enabled: row.personalizedGreetingsEnabled,
      recencyWindowDays: row.greetingRecencyWindowDays,
      confidenceThreshold: normalizeThreshold(row.greetingConfidenceThreshold),
    };
  }

  async updateSettings(
    organizationId: string,
    input: Partial<GreetingSettings>,
    actorUserId?: string,
  ) {
    const current = await this.settings(organizationId);
    const next = {
      enabled: input.enabled ?? current.enabled,
      recencyWindowDays: input.recencyWindowDays ?? current.recencyWindowDays,
      confidenceThreshold: input.confidenceThreshold ?? current.confidenceThreshold,
    };
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        personalizedGreetingsEnabled: next.enabled,
        greetingRecencyWindowDays: Math.min(Math.max(next.recencyWindowDays, 1), 365),
        greetingConfidenceThreshold: next.confidenceThreshold,
      },
      select: {
        personalizedGreetingsEnabled: true,
        greetingRecencyWindowDays: true,
        greetingConfidenceThreshold: true,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        organizationId,
        actorUserId,
        action: next.enabled ? "greeting.settings_updated" : "greeting.disabled",
        entityType: "Organization",
        entityId: organizationId,
        metadata: next as Prisma.InputJsonObject,
      },
    });
    return {
      enabled: updated.personalizedGreetingsEnabled,
      recencyWindowDays: updated.greetingRecencyWindowDays,
      confidenceThreshold: normalizeThreshold(updated.greetingConfidenceThreshold),
    };
  }

  private async track(
    input: {
      organizationId: string;
      interactionId: string;
      channel: GreetingChannel;
      memory: CustomerMemoryContext | null;
    },
    decision: GreetingDecision,
  ) {
    const writes: Promise<unknown>[] = [
      this.prisma.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          action: decision.personalized ? "greeting.generated" : "greeting.fallback_used",
          entityType: "CustomerGreeting",
          entityId: input.memory?.customer.id,
          metadata: {
            channel: input.channel,
            level: decision.level,
            fallbackReason: decision.fallbackReason,
          } satisfies Prisma.InputJsonObject,
        },
      }),
    ];
    if (this.usage) {
      writes.push(
        this.usage.increment({
          organizationId: input.organizationId,
          resourceType: "GREETING_CONTEXT_LOADS",
          idempotencyKey: `greeting:context:${input.channel}:${input.interactionId}`,
        }),
        this.usage.increment({
          organizationId: input.organizationId,
          resourceType: "GREETING_GENERATIONS",
          idempotencyKey: `greeting:generation:${input.channel}:${input.interactionId}`,
        }),
      );
    }
    if (this.analytics) {
      writes.push(
        this.analytics.record({
          organizationId: input.organizationId,
          eventType: "GREETING_GENERATED",
          idempotencyKey: `greeting:generated:${input.channel}:${input.interactionId}`,
          metadata: { level: decision.level, channel: input.channel },
        }),
      );
    }
    await Promise.all(writes);
  }
}

function normalizeThreshold(value: string): GreetingConfidenceThreshold {
  return value === "HIGH" || value === "LOW" ? value : "MEDIUM";
}
