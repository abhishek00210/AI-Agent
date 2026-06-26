import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Outcome, Sentiment } from "../../../generated/prisma";
import { RedisService } from "../../redis/redis.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerResolverService } from "../customer/customer-resolver.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { OpenAiProvider } from "../openai/openai.provider";
import type { TenantContext } from "../tenant/tenant.service";
import { UsageService } from "../usage/usage.service";
import { CALL_SUMMARY_VERSION } from "./call-summary.types";
import type { ListCallSummariesQueryDto } from "./dto/call-summary.dto";
import { CallSummaryRepository } from "./repositories/call-summary.repository";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";

const SUMMARY_INPUT_LIMIT = 45_000;
const CACHE_TTL_SECONDS = 300;

interface StructuredSummary {
  summary: string;
  intent: string;
  sentiment: Sentiment;
  outcome: Outcome;
  nextAction: string | null;
  followUpRequired: boolean;
  confidenceScore: number;
}

@Injectable()
export class CallSummaryService {
  private readonly logger = new Logger(CallSummaryService.name);

  constructor(
    private readonly summaries: CallSummaryRepository,
    private readonly ai: OpenAiProvider,
    private readonly customers: CustomerResolverService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @Optional() private readonly timeline?: CustomerTimelineService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly customerMemory?: CustomerMemoryContextService,
  ) {}

  async generateForTranscript(input: { organizationId: string; transcriptId: string }) {
    const context = await this.summaries.transcriptContext(input.organizationId, input.transcriptId);
    if (!context) throw new NotFoundException("Completed transcript not found.");
    if (!context.fullText.trim()) throw new Error("Transcript is empty.");
    const existing = await this.summaries.findByCallId(input.organizationId, context.callId);

    const customer =
      (await this.customers.findByPhone(input.organizationId, context.call.callerNumber)) ??
      (await this.customers.resolveCustomer({
        organizationId: input.organizationId,
        phone: context.call.callerNumber,
        name: context.call.callerNumber,
        interaction: "PROFILE",
      }));
    const response = await this.ai.generateResponse({
      instructions: summarizationPrompt(),
      messages: [
        {
          role: "user",
          content: [
            `Call metadata:`,
            `Caller: ${context.call.callerNumber}`,
            `Called: ${context.call.calledNumber}`,
            `Agent: ${context.call.agent.name}`,
            `Started: ${context.call.startedAt.toISOString()}`,
            `Duration seconds: ${context.call.durationSeconds ?? "unknown"}`,
            "",
            "Transcript:",
            context.fullText.slice(0, SUMMARY_INPUT_LIMIT),
          ].join("\n"),
        },
      ],
      user: input.organizationId,
    });
    const structured = parseStructuredSummary(response.content);
    const generatedAt = new Date();
    const estimatedCostMicros = this.estimateCostMicros(response.tokenUsage);
    const summary = await this.summaries.upsert({
      organizationId: input.organizationId,
      customerProfileId: customer.id,
      callId: context.callId,
      conversationId: context.conversationId,
      transcriptId: context.id,
      ...structured,
      summaryVersion: CALL_SUMMARY_VERSION,
      model: response.model,
      inputTokens: response.tokenUsage.promptTokens,
      outputTokens: response.tokenUsage.completionTokens,
      totalTokens: response.tokenUsage.totalTokens,
      estimatedCostMicros,
      generatedAt,
    });

    await Promise.all([
      this.invalidate(input.organizationId, summary.id, context.callId, customer.id),
      this.customerMemory?.invalidateCustomer(input.organizationId, customer.id),
      this.summaries.createAuditEvent({
        organizationId: input.organizationId,
        action: existing ? "call_summary.regenerated" : "call_summary.generated",
        entityId: summary.id,
        metadata: {
          callId: context.callId,
          transcriptId: context.id,
          model: response.model,
          summaryVersion: CALL_SUMMARY_VERSION,
        },
      }),
      this.timeline?.recordEvent({
        organizationId: input.organizationId,
        customerProfileId: customer.id,
        eventType: "AI_SUMMARY_GENERATED",
        description: structured.summary,
        sourceEntityType: "CallSummary",
        sourceEntityId: summary.id,
        idempotencyKey: `ai-summary:${context.callId}`,
        metadata: {
          callId: context.callId,
          intent: structured.intent,
          sentiment: structured.sentiment,
          outcome: structured.outcome,
          followUpRequired: structured.followUpRequired,
        },
        occurredAt: generatedAt,
      }),
      this.linkOutboundSummary(input.organizationId, context.callId, summary.id, structured.outcome),
      this.analytics?.record({
        organizationId: input.organizationId,
        eventType: "AI_SUMMARY_GENERATED",
        idempotencyKey: `analytics:ai-summary:${context.callId}`,
        agentId: context.call.agent.id,
        agentName: context.call.agent.name,
        metadata: {
          callId: context.callId,
          intent: structured.intent,
          sentiment: structured.sentiment,
          outcome: structured.outcome,
          followUpRequired: structured.followUpRequired,
        },
      }),
      this.trackUsage(input.organizationId, summary.id, response.tokenUsage, estimatedCostMicros),
    ]);
    return summary;
  }

  private async linkOutboundSummary(
    organizationId: string,
    callId: string,
    summaryId: string,
    outcome: Outcome,
  ) {
    const appointmentBooked = outcome === "BOOKED_APPOINTMENT";
    const qualified = appointmentBooked || outcome === "QUALIFIED_LEAD";
    await this.summaries
      .linkOutboundSummary({ organizationId, callId, summaryId, qualified, appointmentBooked })
      .catch(() => undefined);
  }

  async list(context: TenantContext, query: ListCallSummariesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const [total, data] = await this.summaries.list({
      organizationId: context.organizationId,
      page,
      limit,
      search: query.search?.trim() || undefined,
      sentiment: query.sentiment as Sentiment | undefined,
      outcome: query.outcome as Outcome | undefined,
    });
    return { total, page, limit, data };
  }

  async get(context: TenantContext, id: string) {
    const cached = await this.readCache(`summary:id:${context.organizationId}:${id}`);
    if (cached) return cached;
    const summary = await this.summaries.findById(context.organizationId, id);
    if (!summary) throw new NotFoundException("Call summary not found.");
    await this.writeCache(`summary:id:${context.organizationId}:${id}`, summary);
    return summary;
  }

  async getByCall(context: TenantContext, callId: string) {
    const cached = await this.readCache(`summary:call:${context.organizationId}:${callId}`);
    if (cached) return cached;
    const summary = await this.summaries.findByCallId(context.organizationId, callId);
    if (!summary) return null;
    await this.writeCache(`summary:call:${context.organizationId}:${callId}`, summary);
    return summary;
  }

  async getByCustomer(context: TenantContext, customerProfileId: string, limit?: number) {
    return this.summaries.findByCustomer(context.organizationId, customerProfileId, limit);
  }

  async recordFailure(input: { organizationId: string; transcriptId: string; reason: string }) {
    this.logger.warn(`Call summary generation failed: ${input.reason}`);
    await this.summaries.createAuditEvent({
      organizationId: input.organizationId,
      action: "call_summary.failed",
      metadata: { transcriptId: input.transcriptId, reason: input.reason.slice(0, 500) },
    });
  }

  private async trackUsage(
    organizationId: string,
    summaryId: string,
    tokens: { promptTokens: number; completionTokens: number; totalTokens: number },
    estimatedCostMicros: number,
  ) {
    await Promise.all([
      this.usage?.increment({
        organizationId,
        resourceType: "AI_SUMMARY_GENERATIONS",
        idempotencyKey: `summary:generation:${summaryId}`,
      }),
      tokens.promptTokens
        ? this.usage?.increment({
            organizationId,
            resourceType: "AI_SUMMARY_INPUT_TOKENS",
            quantity: tokens.promptTokens,
            idempotencyKey: `summary:input-tokens:${summaryId}`,
          })
        : undefined,
      tokens.completionTokens
        ? this.usage?.increment({
            organizationId,
            resourceType: "AI_SUMMARY_OUTPUT_TOKENS",
            quantity: tokens.completionTokens,
            idempotencyKey: `summary:output-tokens:${summaryId}`,
          })
        : undefined,
      estimatedCostMicros
        ? this.usage?.increment({
            organizationId,
            resourceType: "AI_SUMMARY_COST_MICROS",
            quantity: estimatedCostMicros,
            idempotencyKey: `summary:cost:${summaryId}`,
          })
        : undefined,
    ]);
  }

  private estimateCostMicros(tokens: { promptTokens: number; completionTokens: number }) {
    const inputPerMillion =
      this.config.get<number>("openai.summaryInputCostPerMillion") ?? 0;
    const outputPerMillion =
      this.config.get<number>("openai.summaryOutputCostPerMillion") ?? 0;
    const usd =
      (tokens.promptTokens / 1_000_000) * inputPerMillion +
      (tokens.completionTokens / 1_000_000) * outputPerMillion;
    return Math.max(0, Math.round(usd * 1_000_000));
  }

  private async invalidate(
    organizationId: string,
    summaryId: string,
    callId: string,
    customerProfileId: string,
  ) {
    if (!this.redis.isAvailable) return;
    await this.redis.cache
      .del(
        `summary:id:${organizationId}:${summaryId}`,
        `summary:call:${organizationId}:${callId}`,
        `summary:customer:${organizationId}:${customerProfileId}`,
      )
      .catch(() => 0);
  }

  private async readCache(key: string) {
    if (!this.redis.isAvailable) return null;
    try {
      const value = await this.redis.cache.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, value: unknown) {
    if (!this.redis.isAvailable) return;
    await this.redis.cache.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS).catch(() => 0);
  }
}

function summarizationPrompt() {
  return [
    "You generate structured CRM call summaries from text transcripts only.",
    "Do not use or infer from audio. Do not invent facts.",
    "Return only valid JSON, no markdown.",
    "Required JSON keys: summary, intent, sentiment, outcome, nextAction, followUpRequired, confidenceScore.",
    "sentiment must be one of POSITIVE, NEUTRAL, NEGATIVE.",
    "outcome must be one of BOOKED_APPOINTMENT, QUALIFIED_LEAD, FOLLOW_UP_REQUIRED, INFORMATION_PROVIDED, TRANSFERRED, UNRESOLVED, OTHER.",
    "confidenceScore must be a number from 0 to 1.",
    "Keep summary under 90 words. Make nextAction null if no clear next action exists.",
  ].join("\n");
}

function parseStructuredSummary(content: string): StructuredSummary {
  const parsed = parseJsonObject(content);
  return {
    summary: readString(parsed.summary, "Summary unavailable.").slice(0, 2000),
    intent: readString(parsed.intent, "General Inquiry").slice(0, 200),
    sentiment: normalizeSentiment(parsed.sentiment),
    outcome: normalizeOutcome(parsed.outcome),
    nextAction: nullableString(parsed.nextAction)?.slice(0, 1000) ?? null,
    followUpRequired: Boolean(parsed.followUpRequired),
    confidenceScore: clamp(Number(parsed.confidenceScore), 0, 1, 0.7),
  };
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSentiment(value: unknown): Sentiment {
  return value === "POSITIVE" || value === "NEGATIVE" || value === "NEUTRAL"
    ? value
    : "NEUTRAL";
}

function normalizeOutcome(value: unknown): Outcome {
  const valid: Outcome[] = [
    "BOOKED_APPOINTMENT",
    "QUALIFIED_LEAD",
    "FOLLOW_UP_REQUIRED",
    "INFORMATION_PROVIDED",
    "TRANSFERRED",
    "UNRESOLVED",
    "OTHER",
  ];
  return valid.includes(value as Outcome) ? (value as Outcome) : "OTHER";
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
