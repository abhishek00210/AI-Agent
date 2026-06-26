import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ExternalNumberVerificationMethod,
  ExternalPhoneNumberStatus,
  Prisma,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ExternalNumberRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.externalPhoneNumber.findMany({
      where: { organizationId },
      include: this.include(),
      orderBy: { createdAt: "desc" },
    });
  }

  findById(organizationId: string, id: string) {
    return this.prisma.externalPhoneNumber.findFirst({
      where: { id, organizationId },
      include: this.include(),
    });
  }

  findByPhoneNumber(phoneNumber: string) {
    return this.prisma.externalPhoneNumber.findUnique({ where: { phoneNumber } });
  }

  platformNumberExists(phoneNumber: string) {
    return this.prisma.phoneNumber.findUnique({
      where: { phoneNumber },
      select: { id: true },
    });
  }

  create(input: {
    organizationId: string;
    phoneNumber: string;
    countryCode: string;
    verificationMethod: ExternalNumberVerificationMethod;
    assignedAgentId?: string | null;
    forwardingTargetPhoneNumberId?: string | null;
    forwardingTargetNumber?: string | null;
  }) {
    return this.prisma.externalPhoneNumber.create({
      data: input,
      include: this.include(),
    });
  }

  findAgent(organizationId: string, agentId: string) {
    return this.prisma.agent.findFirst({
      where: { id: agentId, organizationId, status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true, status: true },
    });
  }

  findForwardingTarget(organizationId: string, phoneNumberId: string, agentId?: string) {
    return this.prisma.phoneNumber.findFirst({
      where: {
        id: phoneNumberId,
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
        releasedAt: null,
        twilioSid: { not: null },
        ...(agentId ? { agentId } : {}),
      },
      select: {
        id: true,
        phoneNumber: true,
        agentId: true,
        capabilities: true,
      },
    });
  }

  findForwardingTargetForAgent(organizationId: string, agentId: string) {
    return this.prisma.phoneNumber.findFirst({
      where: {
        organizationId,
        agentId,
        status: "ACTIVE",
        deletedAt: null,
        releasedAt: null,
        twilioSid: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, phoneNumber: true, agentId: true, capabilities: true },
    });
  }

  findVerificationSender(organizationId: string, preferredPhoneNumberId?: string | null) {
    return this.prisma.phoneNumber.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        deletedAt: null,
        releasedAt: null,
        twilioSid: { not: null },
        ...(preferredPhoneNumberId ? { id: preferredPhoneNumberId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, phoneNumber: true, capabilities: true },
    });
  }

  async reserveVerification(input: {
    organizationId: string;
    id: string;
    method: ExternalNumberVerificationMethod;
    codeHash: string;
    expiresAt: Date;
    now: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`external-otp:${input.id}`}))`;
      const record = await tx.externalPhoneNumber.findFirst({
        where: { id: input.id, organizationId: input.organizationId },
      });
      if (!record) throw new NotFoundException("Existing phone number not found.");
      if (record.status === "DISABLED") throw new ConflictException("Phone number is disabled.");
      if (record.status === "VERIFIED" || record.status === "ACTIVE") {
        throw new ConflictException("Phone number ownership is already verified.");
      }
      if (
        record.lastVerificationSentAt &&
        input.now.getTime() - record.lastVerificationSentAt.getTime() < 60_000
      ) {
        throw new HttpException(
          "Wait 60 seconds before requesting another code.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const windowActive =
        record.verificationWindowStartedAt &&
        input.now.getTime() - record.verificationWindowStartedAt.getTime() < 60 * 60_000;
      const sendCount = windowActive ? record.verificationSendCount : 0;
      if (sendCount >= 5) {
        throw new HttpException(
          "Verification send limit reached. Try again in one hour.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return tx.externalPhoneNumber.update({
        where: { id: record.id },
        data: {
          status: "PENDING",
          verificationMethod: input.method,
          verificationCodeHash: input.codeHash,
          verificationExpiresAt: input.expiresAt,
          verificationAttempts: 0,
          verificationSendCount: sendCount + 1,
          verificationWindowStartedAt: windowActive
            ? record.verificationWindowStartedAt
            : input.now,
          lastVerificationSentAt: input.now,
        },
      });
    });
  }

  verificationRecord(organizationId: string, id: string) {
    return this.prisma.externalPhoneNumber.findFirst({
      where: { id, organizationId },
    });
  }

  incrementVerificationAttempt(organizationId: string, id: string) {
    return this.prisma.externalPhoneNumber.updateMany({
      where: { id, organizationId, status: { in: ["PENDING", "FAILED"] } },
      data: { verificationAttempts: { increment: 1 } },
    });
  }

  markVerificationFailed(organizationId: string, id: string) {
    return this.prisma.externalPhoneNumber.updateMany({
      where: { id, organizationId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "FAILED", verificationCodeHash: null, verificationExpiresAt: null },
    });
  }

  async markVerified(organizationId: string, id: string, expectedHash: string, now: Date) {
    const updated = await this.prisma.externalPhoneNumber.updateMany({
      where: {
        id,
        organizationId,
        verificationCodeHash: expectedHash,
        verificationExpiresAt: { gt: now },
        verificationAttempts: { lt: 5 },
        status: { in: ["PENDING", "FAILED"] },
      },
      data: {
        status: "VERIFIED",
        verifiedAt: now,
        verificationCodeHash: null,
        verificationExpiresAt: null,
        verificationAttempts: 0,
      },
    });
    return updated.count > 0;
  }

  updateAssignment(input: {
    organizationId: string;
    id: string;
    assignedAgentId: string | null;
    forwardingTargetPhoneNumberId: string | null;
    forwardingTargetNumber: string | null;
    status: "PENDING" | "VERIFIED";
  }) {
    return this.prisma.externalPhoneNumber.updateMany({
      where: { id: input.id, organizationId: input.organizationId, status: { not: "DISABLED" } },
      data: {
        assignedAgentId: input.assignedAgentId,
        forwardingTargetPhoneNumberId: input.forwardingTargetPhoneNumberId,
        forwardingTargetNumber: input.forwardingTargetNumber,
        status: input.status,
        forwardingConfirmedAt: null,
        activatedAt: null,
        testSessionHash: null,
        testExpiresAt: null,
      },
    });
  }

  async startTest(input: {
    organizationId: string;
    id: string;
    testSessionHash: string;
    now: Date;
    expiresAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`external-test:${input.id}`}))`;
      const record = await tx.externalPhoneNumber.findFirst({
        where: { id: input.id, organizationId: input.organizationId },
      });
      if (!record) throw new NotFoundException("Existing phone number not found.");
      if (!record.verifiedAt || !["VERIFIED", "ACTIVE"].includes(record.status)) {
        throw new ConflictException("Verify number ownership before testing forwarding.");
      }
      if (!record.assignedAgentId || !record.forwardingTargetPhoneNumberId) {
        throw new ConflictException("Assign an agent with an active Twilio number first.");
      }
      const conflicting = await tx.externalPhoneNumber.findFirst({
        where: {
          id: { not: record.id },
          organizationId: input.organizationId,
          forwardingTargetPhoneNumberId: record.forwardingTargetPhoneNumberId,
          testExpiresAt: { gt: input.now },
          forwardingConfirmedAt: null,
        },
        select: { id: true },
      });
      if (conflicting) {
        throw new ConflictException(
          "Another forwarding test is already waiting on this Twilio number.",
        );
      }
      return tx.externalPhoneNumber.update({
        where: { id: record.id },
        data: {
          status: "VERIFIED",
          testSessionHash: input.testSessionHash,
          testStartedAt: input.now,
          testExpiresAt: input.expiresAt,
          forwardingConfirmedAt: null,
          activatedAt: null,
        },
        include: this.include(),
      });
    });
  }

  findPendingTest(input: {
    organizationId: string;
    forwardingTargetPhoneNumberId: string;
    assignedAgentId: string;
    now: Date;
  }) {
    return this.prisma.externalPhoneNumber.findFirst({
      where: {
        organizationId: input.organizationId,
        forwardingTargetPhoneNumberId: input.forwardingTargetPhoneNumberId,
        assignedAgentId: input.assignedAgentId,
        verifiedAt: { not: null },
        status: { in: ["VERIFIED", "ACTIVE"] },
        testExpiresAt: { gt: input.now },
        testSessionHash: { not: null },
        forwardingConfirmedAt: null,
      },
      orderBy: { testStartedAt: "desc" },
    });
  }

  activateFromTest(organizationId: string, id: string, now: Date) {
    return this.prisma.externalPhoneNumber.updateMany({
      where: {
        id,
        organizationId,
        verifiedAt: { not: null },
        assignedAgentId: { not: null },
        forwardingTargetPhoneNumberId: { not: null },
        testExpiresAt: { gt: now },
        forwardingConfirmedAt: null,
      },
      data: {
        status: "ACTIVE",
        activatedAt: now,
        forwardingConfirmedAt: now,
        lastTestCallAt: now,
        testSessionHash: null,
        testExpiresAt: null,
      },
    });
  }

  disable(organizationId: string, id: string) {
    return this.prisma.externalPhoneNumber.updateMany({
      where: { id, organizationId, status: { not: "DISABLED" } },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        testSessionHash: null,
        testExpiresAt: null,
      },
    });
  }

  setStatus(organizationId: string, id: string, status: ExternalPhoneNumberStatus) {
    return this.prisma.externalPhoneNumber.updateMany({
      where: { id, organizationId },
      data: { status },
    });
  }

  createAudit(input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditEvent.create({
      data: { ...input, entityType: "ExternalPhoneNumber" },
    });
  }

  private include() {
    return {
      assignedAgent: { select: { id: true, name: true, status: true } },
      forwardingTargetPhoneNumber: {
        select: { id: true, phoneNumber: true, status: true, agentId: true },
      },
    } satisfies Prisma.ExternalPhoneNumberInclude;
  }
}
