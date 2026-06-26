import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { CallRoutingService } from "./call-routing.service";
import { normalizeE164 } from "./e164";
import { CallRepository } from "./repositories/call.repository";
import { PhoneNumberRepository } from "./repositories/phone-number.repository";
import { TwiMLResponseService } from "./twiml-response.service";
import { FeatureGateService } from "../billing/feature-gate.service";
import { UsageService } from "../usage/usage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerResolverService } from "../customer/customer-resolver.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { AutomationEngineService } from "../automation/automation-engine.service";
import type { TelephonyProviderName } from "../telephony/providers/telephony-provider.interface";

@Injectable()
export class IncomingCallService {
  constructor(
    private readonly routing: CallRoutingService,
    private readonly phoneNumbers: PhoneNumberRepository,
    private readonly calls: CallRepository,
    private readonly twiml: TwiMLResponseService,
    private readonly metrics: RealtimeMetricsService,
    @Optional() private readonly gates?: FeatureGateService,
    @Optional() private readonly usage?: UsageService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly customers?: CustomerResolverService,
    @Optional() private readonly customerTimeline?: CustomerTimelineService,
    @Optional() private readonly automations?: AutomationEngineService,
  ) {}

  async handle(
    payload: Record<string, unknown>,
    options: { mediaProvider?: TelephonyProviderName } = {},
  ): Promise<string> {
    const webhookStartedAt = this.metrics.now();
    const input = parseWebhook(payload);
    const outbound = isOutboundDirection(input.Direction);
    const calledNumber = normalizeE164(outbound ? input.From : input.To);
    const callerNumber = normalizeCallerNumber(outbound ? input.To : input.From);
    const lookupStartedAt = this.metrics.now();
    const route = await this.routing.resolve(calledNumber);
    this.metrics.observe("db_lookup_ms", lookupStartedAt, Boolean(route));
    if (!route || !route.agentId || !route.agent) {
      this.defer(() => this.auditRoutingFailure(calledNumber, input.CallSid));
      this.metrics.observe("webhook_processing_ms", webhookStartedAt, false);
      return this.twiml.unavailable();
    }
    const forwardingLoop = callerNumber.startsWith("+")
      ? await this.phoneNumbers.findForwardingLoopSource({
          organizationId: route.organizationId,
          forwardingTargetPhoneNumberId: route.id,
          callerNumber,
        })
      : null;
    if (callerNumber === calledNumber || forwardingLoop) {
      this.defer(() =>
        this.audit(route.organizationId, "call.forwarding_loop_blocked", undefined, {
          twilioCallSid: input.CallSid,
          callerNumber,
          calledNumber,
          externalPhoneNumberId: forwardingLoop?.id ?? null,
        }),
      );
      this.metrics.increment("forwarding_loop_blocks");
      this.metrics.observe("webhook_processing_ms", webhookStartedAt, false);
      return this.twiml.unavailable();
    }
    if (
      this.gates &&
      (!(await this.gates.canReceiveCalls(route.organizationId)) ||
        !(await this.gates.canUseRealtimeVoice(route.organizationId)))
    ) {
      this.metrics.observe("webhook_processing_ms", webhookStartedAt, false);
      return this.twiml.unavailable();
    }

    const callInput = {
      organizationId: route.organizationId,
      agentId: route.agentId,
      phoneNumberId: route.id,
      twilioCallSid: input.CallSid,
      callerNumber,
      calledNumber,
      metadata: {
        twilioDirection: input.Direction ?? (outbound ? "outbound-api" : "inbound"),
        timestamp: input.Timestamp ?? null,
        rawFrom: input.From,
        rawTo: input.To,
        callerIdSource: outbound ? "twilio_to_outbound_customer" : "twilio_from",
        ...(outbound ? { outbound: true } : {}),
      } satisfies Prisma.InputJsonObject,
    };
    const call = outbound
      ? await this.calls.createOutbound(callInput)
      : await this.calls.createInbound(callInput);

    this.defer(() => {
      const tasks: Promise<unknown>[] = [
        this.audit(route.organizationId, "call.incoming_received", call.id, {
          twilioCallSid: input.CallSid,
          callerNumber,
          calledNumber,
        }),
        this.audit(route.organizationId, "call.record_created", call.id, {
          status: call.status,
        }),
        this.audit(route.organizationId, "call.routed", call.id, {
          agentId: route.agentId,
          phoneNumberId: route.id,
        }),
        this.calls.updateStatus(route.organizationId, call.id, "ROUTING"),
      ];
      if (this.usage)
        tasks.push(
          this.usage.increment({
            organizationId: route.organizationId,
            resourceType: "INCOMING_CALLS",
            idempotencyKey: `call:incoming:${call.id}`,
          }),
        );
      if (this.analytics)
        tasks.push(
          this.analytics.record({
            organizationId: route.organizationId,
            eventType: "CALL_STARTED",
            idempotencyKey: `call:started:${call.id}`,
            agentId: route.agentId ?? undefined,
          metadata: { direction: outbound ? "OUTBOUND" : "INBOUND", agentName: route.agent?.name ?? "Agent" },
          }),
        );
      if (this.customers && callerNumber.startsWith("+"))
        tasks.push(
          this.customers
            .resolveCustomer({
              organizationId: route.organizationId,
              phone: callerNumber,
              name: callerNumber,
              interaction: "CALL",
            })
            .then((customer) =>
              Promise.all([
                this.customerTimeline?.recordEvent({
                  organizationId: route.organizationId,
                  customerProfileId: customer.id,
                  eventType: "CALL_RECEIVED",
                  sourceEntityType: "Call",
                  sourceEntityId: call.id,
                  idempotencyKey: `call:received:${call.id}`,
                  metadata: { direction: outbound ? "OUTBOUND" : "INBOUND", agentId: route.agentId },
                  occurredAt: call.createdAt,
                }),
                this.automations?.cancelForCustomer(
                  route.organizationId,
                  customer.id,
                  ["NEW_LEAD", "NO_RESPONSE"],
                  "Customer called the business.",
                ),
              ]),
            ),
        );
      return Promise.all(tasks);
    });

    this.metrics.observe("webhook_processing_ms", webhookStartedAt);
    return this.twiml.routing(options.mediaProvider);
  }

  private async auditRoutingFailure(calledNumber: string, twilioCallSid: string) {
    const phoneNumber = await this.phoneNumbers.findByPhoneNumber(calledNumber);
    if (!phoneNumber) {
      return;
    }
    await this.audit(phoneNumber.organizationId, "call.routing_failed", undefined, {
      calledNumber,
      twilioCallSid,
    });
  }

  private audit(
    organizationId: string,
    action: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.calls.createAuditEvent({
      organizationId,
      action,
      entityType: "Call",
      entityId,
      metadata,
    });
  }

  private defer(task: () => Promise<unknown>) {
    setImmediate(() => {
      void task().catch(() => {
        this.metrics.increment("deferred_persistence_failures");
      });
    });
  }
}

function parseWebhook(payload: Record<string, unknown>) {
  const CallSid = requiredString(payload.CallSid, "CallSid");
  const From = requiredString(payload.From, "From");
  const To = requiredString(payload.To, "To");
  return {
    CallSid,
    From,
    To,
    Direction: optionalString(payload.Direction),
    Timestamp: optionalString(payload.Timestamp),
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isOutboundDirection(value?: string) {
  return value?.toLowerCase().startsWith("outbound") ?? false;
}

function normalizeCallerNumber(value: string) {
  try {
    return normalizeE164(value);
  } catch {
    return value.trim();
  }
}
