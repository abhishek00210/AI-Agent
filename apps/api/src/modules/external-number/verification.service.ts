import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { ExternalNumberVerificationMethod } from "../../../generated/prisma";
import type { TenantContext } from "../tenant/tenant.service";
import { TelephonyProviderFactory } from "../telephony/telephony-provider.factory";
import { UsageService } from "../usage/usage.service";
import { ExternalNumberRepository } from "./external-number.repository";

const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class VerificationService {
  constructor(
    private readonly repository: ExternalNumberRepository,
    private readonly telephony: TelephonyProviderFactory,
    private readonly config: ConfigService,
    private readonly usage: UsageService,
  ) {}

  async send(context: TenantContext, id: string, method?: ExternalNumberVerificationMethod) {
    const record = await this.repository.findById(context.organizationId, id);
    if (!record) throw new NotFoundException("Existing phone number not found.");
    const deliveryMethod = method ?? record.verificationMethod;
    const sender = await this.repository.findVerificationSender(
      context.organizationId,
      record.forwardingTargetPhoneNumberId,
    );
    if (!sender) {
      throw new ConflictException(
        "An active Twilio number is required to send ownership verification.",
      );
    }
    assertCapability(sender.capabilities, deliveryMethod);
    const code = String(randomInt(100_000, 1_000_000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.repository.reserveVerification({
      organizationId: context.organizationId,
      id,
      method: deliveryMethod,
      codeHash: this.hash(context.organizationId, id, code),
      expiresAt,
      now,
    });
    try {
      if (deliveryMethod === "SMS") {
        await this.telephony.resolve({ organizationCountry: record.countryCode }).verifyNumber({
          to: record.phoneNumber,
          from: sender.phoneNumber,
          code,
          method: "SMS",
        });
      } else {
        await this.telephony.resolve({ organizationCountry: record.countryCode }).verifyNumber({
          to: record.phoneNumber,
          from: sender.phoneNumber,
          code,
          method: "VOICE",
        });
      }
    } catch (error) {
      await this.repository.markVerificationFailed(context.organizationId, id);
      await this.repository.createAudit({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "external_number.otp_delivery_failed",
        entityId: id,
        metadata: { method: deliveryMethod },
      });
      throw new ServiceUnavailableException(providerMessage(error));
    }
    await this.repository.createAudit({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: "external_number.otp_sent",
      entityId: id,
      metadata: { method: deliveryMethod, expiresAt },
    });
    return { sent: true, method: deliveryMethod, expiresAt };
  }

  async verify(context: TenantContext, id: string, code: string) {
    const record = await this.repository.verificationRecord(context.organizationId, id);
    if (!record) throw new NotFoundException("Existing phone number not found.");
    if (record.status === "VERIFIED" || record.status === "ACTIVE") {
      return { verified: true, verifiedAt: record.verifiedAt };
    }
    await this.usage.increment({
      organizationId: context.organizationId,
      resourceType: "PHONE_VERIFICATION_ATTEMPTS",
      idempotencyKey: `external-number:verification:${id}:${record.verificationAttempts + 1}:${record.verificationExpiresAt?.getTime() ?? 0}`,
      metadata: { externalNumberId: id },
    });
    const now = new Date();
    if (
      !record.verificationCodeHash ||
      !record.verificationExpiresAt ||
      record.verificationExpiresAt <= now
    ) {
      await this.repository.markVerificationFailed(context.organizationId, id);
      throw new BadRequestException("Verification code expired. Request a new code.");
    }
    if (record.verificationAttempts >= MAX_ATTEMPTS) {
      await this.repository.markVerificationFailed(context.organizationId, id);
      throw new BadRequestException("Verification attempt limit reached. Request a new code.");
    }
    const candidate = this.hash(context.organizationId, id, code);
    if (!secureEqual(candidate, record.verificationCodeHash)) {
      await this.repository.incrementVerificationAttempt(context.organizationId, id);
      if (record.verificationAttempts + 1 >= MAX_ATTEMPTS) {
        await this.repository.markVerificationFailed(context.organizationId, id);
      }
      throw new BadRequestException("Verification code is incorrect.");
    }
    const verified = await this.repository.markVerified(
      context.organizationId,
      id,
      record.verificationCodeHash,
      now,
    );
    if (!verified) throw new BadRequestException("Verification code is no longer valid.");
    await this.repository.createAudit({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: "external_number.otp_verified",
      entityId: id,
      metadata: { method: record.verificationMethod },
    });
    return { verified: true, verifiedAt: now };
  }

  private hash(organizationId: string, id: string, code: string) {
    const secret =
      this.config.get<string>("externalNumber.otpSecret") ||
      this.config.getOrThrow<string>("jwt.accessSecret");
    return createHmac("sha256", secret).update(`${organizationId}:${id}:${code}`).digest("hex");
  }
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertCapability(value: unknown, method: ExternalNumberVerificationMethod) {
  const capabilities = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const supported = method === "SMS" ? capabilities.sms : capabilities.voice;
  if (supported === false) {
    throw new ConflictException(`Selected Twilio number does not support ${method.toLowerCase()}.`);
  }
}

function providerMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Provider rejected verification.";
  return `Verification could not be delivered: ${message}`;
}
