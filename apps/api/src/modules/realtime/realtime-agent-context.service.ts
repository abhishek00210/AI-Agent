import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { MemoryService } from "../memory/memory.service";
import { CustomerMemoryContextService } from "../customer-memory/customer-memory-context.service";
import { GreetingService } from "../customer-memory/greeting.service";
import { PromptMemoryBuilder } from "../customer-memory/prompt-memory.builder";
import type { TenantContext } from "../tenant/tenant.service";
import type { RealtimeAgentContext, RealtimeVoice } from "./realtime.types";
import { RealtimeSessionRepository } from "./repositories/realtime-session.repository";

@Injectable()
export class RealtimeAgentContextService {
  constructor(
    private readonly sessions: RealtimeSessionRepository,
    private readonly memory: MemoryService,
    @Optional() private readonly customerMemory?: CustomerMemoryContextService,
    @Optional() private readonly memoryPrompts?: PromptMemoryBuilder,
    @Optional() private readonly greetings?: GreetingService,
  ) {}

  async load(streamSid: string) {
    const callSession = await this.sessions.findCallSessionByStreamSid(streamSid);
    if (
      !callSession ||
      callSession.organizationId !== callSession.call.organizationId ||
      callSession.call.agent.status !== "ACTIVE" ||
      callSession.call.agent.deletedAt
    ) {
      throw new NotFoundException("Active agent context not found for media stream.");
    }

    const agent = callSession.call.agent;
    const context: RealtimeAgentContext = {
      organizationId: callSession.organizationId,
      callId: callSession.callId,
      callSessionId: callSession.id,
      callerNumber: callSession.call.callerNumber,
      callDirection: callSession.call.direction,
      outboundReasonType: jsonString(callSession.call.metadata, "reasonType"),
      outboundReasonDescription: jsonString(callSession.call.metadata, "reasonDescription"),
      agentId: agent.id,
      agentName: agent.name,
      agentUpdatedAt: agent.updatedAt?.toISOString(),
      systemPrompt: agent.systemPrompt,
      language: agent.language,
      voice: mapRealtimeVoice(agent.voice),
      knowledgeBaseIds: agent.knowledgeBases.map((knowledgeBase) => knowledgeBase.id),
      knowledgeBaseUpdatedAt: agent.knowledgeBases
        .map((knowledgeBase) => knowledgeBase.updatedAt?.toISOString())
        .filter((value): value is string => Boolean(value)),
    };

    return context;
  }

  async memoryInstructions(
    context: TenantContext,
    conversationId: string,
    realtime?: RealtimeAgentContext,
  ) {
    return (await this.memoryBundle(context, conversationId, realtime)).instructions;
  }

  async memoryBundle(
    context: TenantContext,
    conversationId: string,
    realtime?: RealtimeAgentContext,
  ) {
    const [memory, priorSummaries] = await Promise.all([
      this.memory.getPromptMemory(context, conversationId),
      realtime?.callerNumber && !this.customerMemory
        ? this.sessions.recentCustomerSummaries(
            context.organizationId,
            realtime.callerNumber,
            realtime.callId,
          )
        : Promise.resolve([]),
    ]);
    const customer =
      realtime?.callerNumber && this.customerMemory
        ? await this.customerMemory.buildForPhone({
            organizationId: context.organizationId,
            phone: realtime.callerNumber,
            interactionId: realtime.callId,
            excludeCallId: realtime.callId,
            channel: "VOICE",
          })
        : null;
    const facts = memory.facts.map((fact) => `${fact.factKey}: ${fact.factValue}`).join("\n");
    const priorCalls = priorSummaries
      .map(
        (summary) =>
          `${summary.generatedAt.toISOString()}: ${summary.summary} Intent: ${summary.intent}. Outcome: ${summary.outcome}.${summary.nextAction ? ` Next action: ${summary.nextAction}` : ""}`,
      )
      .join("\n");

    const instructions = [
      memory.summary ? `Conversation memory:\n${memory.summary}` : "",
      facts ? `Known facts:\n${facts}` : "",
      customer?.recognized ? customer.promptContext : "",
      priorCalls
        ? `Recent customer call context:\n${priorCalls}\nUse this only for relevant personalization. Do not assume old details are still current.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const greetingDecision =
      this.greetings && realtime
        ? await this.greetings.build({
            organizationId: context.organizationId,
            interactionId: realtime.callId,
            channel: "VOICE",
            memory: customer,
          })
        : null;
    return {
      instructions,
      customerMemory: customer,
      greetingInstructions: greetingDecision?.instructions ?? (
        customer?.recognized && this.memoryPrompts
          ? this.memoryPrompts.personalizedGreeting(customer)
          : null
      ),
      greetingDecision,
    };
  }

  async recordMemoryPromptInjection(
    realtime: RealtimeAgentContext,
    customerProfileId: string,
    personalizedGreeting: boolean,
  ) {
    await this.customerMemory?.recordPromptInjection({
      organizationId: realtime.organizationId,
      customerProfileId,
      interactionId: realtime.callId,
      channel: "VOICE",
      personalizedGreeting,
    });
  }
}

function jsonString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>)[key];
  return typeof result === "string" ? result : null;
}

export function mapRealtimeVoice(voice: string): RealtimeVoice {
  const normalized = voice.toLowerCase();
  if (
    normalized === "alloy" ||
    normalized === "echo" ||
    normalized === "shimmer" ||
    normalized === "verse" ||
    normalized === "cedar" ||
    normalized === "coral"
  ) {
    return normalized;
  }

  const legacyMap: Record<string, RealtimeVoice> = {
    fable: "verse",
    onyx: "cedar",
    nova: "coral",
  };
  return legacyMap[normalized] ?? "alloy";
}
