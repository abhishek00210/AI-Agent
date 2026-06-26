import { Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { RealtimeConversationService } from "./realtime-conversation.service";
import type { RealtimeAgentContext } from "./realtime.types";
import { RealtimeSessionRepository } from "./repositories/realtime-session.repository";
import { DeferredPersistenceService } from "./deferred-persistence.service";
import { FeatureGateService } from "../billing/feature-gate.service";

@Injectable()
export class RealtimeSessionService {
  private readonly audioCounters = new Map<string, { sent: number; received: number }>();
  constructor(
    private readonly sessions: RealtimeSessionRepository,
    private readonly conversations: RealtimeConversationService,
    private readonly persistence: DeferredPersistenceService,
    @Optional() private readonly gates?: FeatureGateService,
  ) {}

  async create(context: RealtimeAgentContext, streamSid: string) {
    await this.gates?.assertCapability(context.organizationId, "realtimeVoice");
    await this.gates?.assertAvailable(context.organizationId, "voiceMinutes");
    const tenant = voiceTenant(context.organizationId);
    const existing = await this.sessions.findByCallSessionId(context.callSessionId);
    if (existing?.conversationId) {
      return {
        session: existing,
        conversationId: existing.conversationId,
        tenant,
      };
    }

    const conversation = await this.conversations.create(tenant, context.agentId, streamSid);
    const session = await this.sessions.upsertConnecting({
      organizationId: context.organizationId,
      callId: context.callId,
      callSessionId: context.callSessionId,
      agentId: context.agentId,
      conversationId: conversation.id,
    });
    this.audioCounters.set(session.id, { sent: 0, received: 0 });
    this.persistence.enqueue(() =>
      this.audit(context.organizationId, "realtime.session_created", session.id, {
        callId: context.callId,
        callSessionId: context.callSessionId,
        streamSid,
      }),
    );
    return { session, conversationId: conversation.id, tenant };
  }

  async connected(realtimeSessionId: string, organizationId: string, openAiSessionId?: string) {
    const session = await this.sessions.markConnected(realtimeSessionId, openAiSessionId);
    await this.audit(organizationId, "realtime.session_connected", realtimeSessionId, {
      openAiSessionId: openAiSessionId ?? null,
    });
    return session;
  }

  async disconnected(realtimeSessionId: string, tenant: TenantContext, conversationId: string) {
    const counters = this.takeAudioCounters(realtimeSessionId);
    const result = await this.sessions.markClosedIfActive(
      realtimeSessionId,
      "DISCONNECTED",
      counters.sent,
      counters.received,
    );
    await this.conversations.close(tenant, conversationId);
    if (result.changed) {
      await this.audit(tenant.organizationId, "realtime.session_disconnected", realtimeSessionId);
    }
    return result.session;
  }

  async failed(
    realtimeSessionId: string,
    tenant: TenantContext,
    conversationId: string,
    reason: string,
  ) {
    const counters = this.takeAudioCounters(realtimeSessionId);
    const result = await this.sessions.markClosedIfActive(
      realtimeSessionId,
      "FAILED",
      counters.sent,
      counters.received,
    );
    await this.conversations.close(tenant, conversationId);
    if (result.changed) {
      await this.audit(tenant.organizationId, "realtime.session_failed", realtimeSessionId, {
        reason,
      });
    }
    return result.session;
  }

  recordAudioSent(realtimeSessionId: string) {
    const counters = this.audioCounters.get(realtimeSessionId) ?? { sent: 0, received: 0 };
    counters.sent += 1;
    this.audioCounters.set(realtimeSessionId, counters);
  }

  recordAudioReceived(realtimeSessionId: string) {
    const counters = this.audioCounters.get(realtimeSessionId) ?? { sent: 0, received: 0 };
    counters.received += 1;
    this.audioCounters.set(realtimeSessionId, counters);
  }

  recordLatency(realtimeSessionId: string, latencyMs: number) {
    return this.sessions.recordLatency(realtimeSessionId, latencyMs);
  }

  async listForCall(context: TenantContext, callId: string) {
    return this.sessions.findByCallId(context.organizationId, callId);
  }

  stats(context: TenantContext) {
    return this.sessions.stats(context.organizationId);
  }

  private audit(
    organizationId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.sessions.createAuditEvent({
      organizationId,
      action,
      entityType: "RealtimeSession",
      entityId,
      metadata,
    });
  }

  private takeAudioCounters(realtimeSessionId: string) {
    const counters = this.audioCounters.get(realtimeSessionId) ?? { sent: 0, received: 0 };
    this.audioCounters.delete(realtimeSessionId);
    return counters;
  }
}

export function voiceTenant(organizationId: string): TenantContext {
  return {
    organizationId,
    // Voice calls are unauthenticated system actors, not rows in the users table.
    // The public prefix keeps audit writers from creating an invalid user relation.
    userId: "public-voice-call",
    email: "voice-call@system.local",
    role: "MEMBER",
  };
}
