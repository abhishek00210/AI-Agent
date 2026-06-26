import { Injectable, Logger, NotFoundException, OnModuleDestroy, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { CallSessionRepository } from "./repositories/call-session.repository";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { ForwardingTestService } from "../external-number/forwarding-test.service";

@Injectable()
export class CallSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(CallSessionService.name);
  private readonly packetCounts = new Map<string, number>();

  constructor(
    private readonly sessions: CallSessionRepository,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly forwardingTests?: ForwardingTestService,
  ) {}

  async listForCall(context: TenantContext, callId: string) {
    const sessions = await this.sessions.findByCallId(context.organizationId, callId);
    return sessions.map(toCallSessionResponse);
  }

  async start(input: {
    streamSid: string;
    twilioCallSid: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const call = await this.sessions.findCallByTwilioSid(input.twilioCallSid);
    if (!call) {
      throw new NotFoundException("Call not found for media stream.");
    }

    const session = await this.sessions.upsertStarted({
      callId: call.id,
      organizationId: call.organizationId,
      twilioCallSid: call.twilioCallSid,
      streamSid: input.streamSid,
    });
    this.packetCounts.set(input.streamSid, 0);

    await Promise.all([
      this.audit(call.organizationId, "media_stream.started", session.id, {
        streamSid: input.streamSid,
        twilioCallSid: input.twilioCallSid,
      }),
      this.audit(call.organizationId, "call_session.created", session.id, input.metadata),
    ]);

    if (this.forwardingTests) {
      setImmediate(() => {
        void this.forwardingTests!.confirmForwardedCall({
          organizationId: call.organizationId,
          forwardingTargetPhoneNumberId: call.phoneNumberId,
          assignedAgentId: call.agentId,
          callId: call.id,
        }).catch((error) => {
          this.logger.warn(
            `Forwarding test confirmation failed: ${error instanceof Error ? error.name : "UnknownError"}`,
          );
        });
      });
    }

    return session;
  }

  recordPacket(streamSid: string) {
    const packetCount = (this.packetCounts.get(streamSid) ?? 0) + 1;
    this.packetCounts.set(streamSid, packetCount);
    return { streamSid, packetCount };
  }

  async stop(streamSid: string) {
    const packetCount = this.packetCounts.get(streamSid) ?? 0;
    this.packetCounts.delete(streamSid);
    const session = await this.sessions.close(streamSid, "DISCONNECTED", packetCount);
    await this.audit(session.organizationId, "media_stream.stopped", session.id, {
      streamSid,
      packetCount: session.packetCount,
    });
    await this.audit(session.organizationId, "call_session.closed", session.id, {
      streamSid,
      status: "DISCONNECTED",
    });
    const durationSeconds =
      session.connectedAt && session.disconnectedAt
        ? Math.max(
            0,
            Math.ceil((session.disconnectedAt.getTime() - session.connectedAt.getTime()) / 1_000),
          )
        : 0;
    if (durationSeconds > 0 && this.usage) {
      const billableMinutes = Math.ceil(durationSeconds / 60);
      await Promise.all([
        this.usage.increment({
          organizationId: session.organizationId,
          resourceType: "AI_MINUTES",
          quantity: billableMinutes,
          idempotencyKey: `call:minutes:${session.id}`,
          metadata: { durationSeconds },
        }),
        this.usage.increment({
          organizationId: session.organizationId,
          resourceType: "REALTIME_VOICE_MINUTES",
          quantity: billableMinutes,
          idempotencyKey: `call:realtime-minutes:${session.id}`,
          metadata: { durationSeconds },
        }),
      ]);
    }
    if (durationSeconds > 0)
      await this.analytics?.record({
        organizationId: session.organizationId,
        eventType: "CALL_DURATION",
        idempotencyKey: `call:duration:${session.id}`,
        metadata: { durationSeconds, aiMinutes: Math.ceil(durationSeconds / 60) },
      });
    return session;
  }

  async fail(streamSid: string, reason: string) {
    const packetCount = this.packetCounts.get(streamSid) ?? 0;
    this.packetCounts.delete(streamSid);
    const session = await this.sessions.close(streamSid, "FAILED", packetCount);
    await this.audit(session.organizationId, "media_stream.failed", session.id, {
      streamSid,
      reason,
    });
    return session;
  }

  async onModuleDestroy() {
    const pending = [...this.packetCounts.entries()];
    this.packetCounts.clear();
    await Promise.allSettled(
      pending.map(([streamSid, packetCount]) =>
        this.sessions.close(streamSid, "DISCONNECTED", packetCount),
      ),
    );
    if (pending.length > 0) {
      this.logger.log(`Flushed ${pending.length} active media session counters.`);
    }
  }

  async stats(context: TenantContext) {
    return this.sessions.stats(context.organizationId);
  }

  private audit(
    organizationId: string,
    action: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.sessions.createAuditEvent({
      organizationId,
      action,
      entityType: "CallSession",
      entityId,
      metadata,
    });
  }
}

export function toCallSessionResponse(session: {
  id: string;
  callId: string;
  organizationId: string;
  twilioCallSid: string;
  streamSid: string | null;
  status: string;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  packetCount: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id,
    callId: session.callId,
    organizationId: session.organizationId,
    twilioCallSid: session.twilioCallSid,
    streamSid: session.streamSid,
    status: session.status,
    connectedAt: session.connectedAt,
    disconnectedAt: session.disconnectedAt,
    packetCount: session.packetCount,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
