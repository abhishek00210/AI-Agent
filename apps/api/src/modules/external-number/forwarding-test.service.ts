import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { TenantContext } from "../tenant/tenant.service";
import { UsageService } from "../usage/usage.service";
import { ExternalNumberRepository } from "./external-number.repository";
import { serializeExternalNumber } from "./external-number.service";

const TEST_WINDOW_MS = 10 * 60_000;

@Injectable()
export class ForwardingTestService {
  constructor(
    private readonly repository: ExternalNumberRepository,
    private readonly usage: UsageService,
  ) {}

  async start(context: TenantContext, id: string) {
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TEST_WINDOW_MS);
    const record = await this.repository.startTest({
      organizationId: context.organizationId,
      id,
      testSessionHash: createHash("sha256").update(sessionId).digest("hex"),
      now,
      expiresAt,
    });
    await Promise.all([
      this.usage.increment({
        organizationId: context.organizationId,
        resourceType: "PHONE_FORWARDING_TESTS",
        idempotencyKey: `external-number:test:${sessionId}`,
        metadata: { externalNumberId: id },
      }),
      this.repository.createAudit({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "external_number.test_started",
        entityId: id,
        metadata: { expiresAt },
      }),
    ]);
    return {
      sessionId,
      expiresAt,
      status: "WAITING_FOR_CALL" as const,
      instruction:
        "Call your existing business number from another phone. Activation occurs when the forwarded call reaches the assigned AI agent.",
      externalNumber: serializeExternalNumber(record),
    };
  }

  async confirmForwardedCall(input: {
    organizationId: string;
    forwardingTargetPhoneNumberId: string;
    assignedAgentId: string;
    callId: string;
  }) {
    const now = new Date();
    const record = await this.repository.findPendingTest({
      organizationId: input.organizationId,
      forwardingTargetPhoneNumberId: input.forwardingTargetPhoneNumberId,
      assignedAgentId: input.assignedAgentId,
      now,
    });
    if (!record) return null;
    const activated = await this.repository.activateFromTest(input.organizationId, record.id, now);
    if (!activated.count) return null;
    await Promise.all([
      this.usage.increment({
        organizationId: input.organizationId,
        resourceType: "PHONE_FORWARDING_ACTIVATIONS",
        idempotencyKey: `external-number:activation:${record.id}:${record.testStartedAt?.getTime() ?? now.getTime()}`,
        metadata: { externalNumberId: record.id },
      }),
      this.repository.createAudit({
        organizationId: input.organizationId,
        action: "external_number.forwarding_confirmed",
        entityId: record.id,
        metadata: { callId: input.callId, assignedAgentId: input.assignedAgentId },
      }),
    ]);
    return { id: record.id, status: "ACTIVE" as const, forwardingConfirmedAt: now };
  }
}
