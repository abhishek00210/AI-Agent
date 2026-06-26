import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ExternalNumberVerificationMethod, Prisma } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { UsageService } from "../usage/usage.service";
import { normalizeE164 } from "../voice/e164";
import type {
  AssignExternalNumberAgentDto,
  CreateExternalNumberDto,
} from "./dto/external-number.dto";
import { ExternalNumberRepository } from "./external-number.repository";
import { VerificationService } from "./verification.service";

@Injectable()
export class ExternalNumberService {
  constructor(
    private readonly repository: ExternalNumberRepository,
    private readonly verification: VerificationService,
    private readonly usage: UsageService,
  ) {}

  async list(context: TenantContext) {
    const rows = await this.repository.list(context.organizationId);
    return { total: rows.length, data: rows.map(serializeExternalNumber) };
  }

  async get(context: TenantContext, id: string) {
    return serializeExternalNumber(await this.getOrThrow(context.organizationId, id));
  }

  async create(context: TenantContext, input: CreateExternalNumberDto) {
    const phoneNumber = normalizeE164(input.phoneNumber);
    const [existing, platformNumber] = await Promise.all([
      this.repository.findByPhoneNumber(phoneNumber),
      this.repository.platformNumberExists(phoneNumber),
    ]);
    if (existing) throw new ConflictException("This business number is already registered.");
    if (platformNumber) {
      throw new ConflictException(
        "A platform Twilio number cannot be added as an external number.",
      );
    }
    const assignment = await this.resolveAssignment(
      context.organizationId,
      input.assignedAgentId,
      input.forwardingTargetPhoneNumberId,
    );
    const record = await this.repository.create({
      organizationId: context.organizationId,
      phoneNumber,
      countryCode: input.countryCode,
      verificationMethod: input.verificationMethod ?? "SMS",
      assignedAgentId: assignment.agentId,
      forwardingTargetPhoneNumberId: assignment.target?.id ?? null,
      forwardingTargetNumber: assignment.target?.phoneNumber ?? null,
    });
    await Promise.all([
      this.usage.increment({
        organizationId: context.organizationId,
        resourceType: "EXTERNAL_PHONE_NUMBERS",
        idempotencyKey: `external-number:created:${record.id}`,
        metadata: { externalNumberId: record.id, countryCode: record.countryCode },
      }),
      this.audit(context, "external_number.added", record.id, {
        countryCode: record.countryCode,
        assignedAgentId: record.assignedAgentId,
      }),
    ]);
    try {
      const delivery = await this.verification.send(
        context,
        record.id,
        input.verificationMethod as ExternalNumberVerificationMethod | undefined,
      );
      return {
        ...serializeExternalNumber(
          (await this.repository.findById(context.organizationId, record.id))!,
        ),
        verificationDelivery: delivery,
      };
    } catch (error) {
      return {
        ...serializeExternalNumber(
          (await this.repository.findById(context.organizationId, record.id))!,
        ),
        verificationDelivery: {
          sent: false,
          error: error instanceof Error ? error.message : "Verification delivery failed.",
        },
      };
    }
  }

  async assign(context: TenantContext, id: string, input: AssignExternalNumberAgentDto) {
    const record = await this.getOrThrow(context.organizationId, id);
    const assignment = input.agentId
      ? await this.resolveAssignment(
          context.organizationId,
          input.agentId,
          input.forwardingTargetPhoneNumberId,
        )
      : { agentId: null, target: null };
    const result = await this.repository.updateAssignment({
      organizationId: context.organizationId,
      id,
      assignedAgentId: assignment.agentId,
      forwardingTargetPhoneNumberId: assignment.target?.id ?? null,
      forwardingTargetNumber: assignment.target?.phoneNumber ?? null,
      status: record.verifiedAt ? "VERIFIED" : "PENDING",
    });
    if (!result.count) throw new ConflictException("Disabled numbers cannot be reassigned.");
    await this.audit(context, "external_number.agent_assigned", id, {
      assignedAgentId: assignment.agentId,
      forwardingTargetPhoneNumberId: assignment.target?.id ?? null,
      activationReset: Boolean(record.activatedAt),
    });
    return this.get(context, id);
  }

  async disable(context: TenantContext, id: string) {
    await this.getOrThrow(context.organizationId, id);
    const result = await this.repository.disable(context.organizationId, id);
    if (result.count) {
      await Promise.all([
        this.usage.decrement({
          organizationId: context.organizationId,
          resourceType: "EXTERNAL_PHONE_NUMBERS",
          idempotencyKey: `external-number:disabled:${id}`,
          metadata: { externalNumberId: id },
        }),
        this.audit(context, "external_number.disabled", id),
      ]);
    }
    return this.get(context, id);
  }

  async adminDisable(organizationId: string, id: string) {
    const record = await this.getOrThrow(organizationId, id);
    const result = await this.repository.disable(organizationId, id);
    if (result.count) {
      await Promise.all([
        this.usage.decrement({
          organizationId,
          resourceType: "EXTERNAL_PHONE_NUMBERS",
          idempotencyKey: `external-number:disabled:${id}`,
          metadata: { externalNumberId: id, source: "ADMIN" },
        }),
        this.repository.createAudit({
          organizationId,
          action: "external_number.disabled_by_admin",
          entityId: id,
        }),
      ]);
    }
    return serializeExternalNumber({ ...record, status: "DISABLED" as const });
  }

  async adminAssign(organizationId: string, id: string, agentId: string | null) {
    const record = await this.getOrThrow(organizationId, id);
    const assignment = agentId
      ? await this.resolveAssignment(organizationId, agentId, undefined)
      : { agentId: null, target: null };
    const updated = await this.repository.updateAssignment({
      organizationId,
      id,
      assignedAgentId: assignment.agentId,
      forwardingTargetPhoneNumberId: assignment.target?.id ?? null,
      forwardingTargetNumber: assignment.target?.phoneNumber ?? null,
      status: record.verifiedAt ? "VERIFIED" : "PENDING",
    });
    if (!updated.count) throw new ConflictException("Disabled numbers cannot be reassigned.");
    await this.repository.createAudit({
      organizationId,
      action: "external_number.reassigned_by_admin",
      entityId: id,
      metadata: {
        assignedAgentId: assignment.agentId,
        activationReset: Boolean(record.activatedAt),
      },
    });
    return this.getOrThrow(organizationId, id).then(serializeExternalNumber);
  }

  private async resolveAssignment(
    organizationId: string,
    agentId?: string,
    forwardingTargetPhoneNumberId?: string,
  ) {
    if (!agentId && !forwardingTargetPhoneNumberId) return { agentId: null, target: null };
    let resolvedAgentId = agentId;
    if (resolvedAgentId) {
      const agent = await this.repository.findAgent(organizationId, resolvedAgentId);
      if (!agent) throw new NotFoundException("Active agent not found.");
    }
    const target = forwardingTargetPhoneNumberId
      ? await this.repository.findForwardingTarget(
          organizationId,
          forwardingTargetPhoneNumberId,
          resolvedAgentId,
        )
      : resolvedAgentId
        ? await this.repository.findForwardingTargetForAgent(organizationId, resolvedAgentId)
        : null;
    if (!target) {
      throw new ConflictException(
        "Assign the agent to an active Twilio number before configuring call forwarding.",
      );
    }
    if (!resolvedAgentId) resolvedAgentId = target.agentId ?? undefined;
    if (!resolvedAgentId) {
      throw new ConflictException("The forwarding target must be assigned to an active agent.");
    }
    return { agentId: resolvedAgentId, target };
  }

  private async getOrThrow(organizationId: string, id: string) {
    const record = await this.repository.findById(organizationId, id);
    if (!record) throw new NotFoundException("Existing phone number not found.");
    return record;
  }

  private audit(
    context: TenantContext,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.repository.createAudit({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action,
      entityId,
      metadata,
    });
  }
}

export function serializeExternalNumber(record: ExternalNumberRecord) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    phoneNumber: record.phoneNumber,
    countryCode: record.countryCode,
    status: record.status,
    assignedAgentId: record.assignedAgentId,
    assignedAgent: record.assignedAgent ?? null,
    forwardingTargetPhoneNumberId: record.forwardingTargetPhoneNumberId,
    forwardingTargetNumber: record.forwardingTargetNumber,
    verificationMethod: record.verificationMethod,
    verificationExpiresAt: record.verificationExpiresAt,
    verifiedAt: record.verifiedAt,
    activatedAt: record.activatedAt,
    lastTestCallAt: record.lastTestCallAt,
    forwardingConfirmedAt: record.forwardingConfirmedAt,
    testStartedAt: record.testStartedAt,
    testExpiresAt: record.testExpiresAt,
    disabledAt: record.disabledAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    testStatus: testStatus(record),
    forwardingInstructions: record.forwardingTargetNumber
      ? instructions(record.countryCode, record.forwardingTargetNumber)
      : null,
  };
}

function testStatus(record: ExternalNumberRecord) {
  if (record.forwardingConfirmedAt) return "PASSED" as const;
  if (!record.testStartedAt) return "NOT_STARTED" as const;
  if (record.testExpiresAt && record.testExpiresAt <= new Date()) return "EXPIRED" as const;
  return "WAITING_FOR_CALL" as const;
}

function instructions(countryCode: string, target: string) {
  const byCountry: Record<string, { enableCode: string; disableCode: string; notes: string[] }> = {
    CA: {
      enableCode: `*72 ${target}`,
      disableCode: "*73",
      notes: ["Common for Canadian carriers; confirm the exact code with your carrier."],
    },
    US: {
      enableCode: `*72 ${target}`,
      disableCode: "*73",
      notes: ["Common for US carriers; mobile and VoIP providers may use account settings."],
    },
    GB: {
      enableCode: `*21*${target}#`,
      disableCode: "#21#",
      notes: [
        "Carrier codes vary in the UK; use your carrier portal when star codes are unavailable.",
      ],
    },
    AU: {
      enableCode: `**21*${target}#`,
      disableCode: "##21#",
      notes: ["Australian carrier forwarding codes vary by fixed, mobile, and VoIP service."],
    },
  };
  return {
    target,
    ...(byCountry[countryCode] ?? byCountry.US),
    steps: [
      "Enable unconditional call forwarding with your carrier.",
      `Forward all calls to ${target}.`,
      "Start a forwarding test here, then call your existing number from another phone.",
      "Keep forwarding enabled after the test passes.",
    ],
  };
}

type ExternalNumberRecord = Awaited<ReturnType<ExternalNumberRepository["findById"]>> & object;
