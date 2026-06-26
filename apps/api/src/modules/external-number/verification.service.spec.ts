import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { VerificationService } from "./verification.service";

describe("VerificationService", () => {
  const repository = {
    findById: jest.fn(),
    findVerificationSender: jest.fn(),
    reserveVerification: jest.fn(),
    markVerificationFailed: jest.fn(),
    createAudit: jest.fn(),
    verificationRecord: jest.fn(),
    incrementVerificationAttempt: jest.fn(),
    markVerified: jest.fn(),
  };
  const provider = {
    verifyNumber: jest.fn(),
  };
  const telephony = { resolve: jest.fn(() => provider) };
  const config = {
    get: jest.fn(),
    getOrThrow: jest.fn(() => "jwt-secret"),
  };
  const usage = { increment: jest.fn() };
  const service = new VerificationService(
    repository as never,
    telephony as never,
    config as never,
    usage as never,
  );
  const context = {
    organizationId: "org-1",
    userId: "user-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    telephony.resolve.mockReturnValue(provider);
    config.get.mockImplementation((key: string) =>
      key === "externalNumber.otpSecret" ? "otp-secret" : undefined,
    );
    config.getOrThrow.mockReturnValue("jwt-secret");
    repository.reserveVerification.mockResolvedValue(undefined);
    repository.createAudit.mockResolvedValue(undefined);
    repository.markVerificationFailed.mockResolvedValue(undefined);
    repository.incrementVerificationAttempt.mockResolvedValue({ count: 1 });
    provider.verifyNumber.mockResolvedValue(undefined);
    usage.increment.mockResolvedValue(undefined);
  });

  it("sends verification through an owned active Twilio number and stores only a hash", async () => {
    repository.findById.mockResolvedValue(externalNumber());
    repository.findVerificationSender.mockResolvedValue({
      id: "phone-1",
      phoneNumber: "+14165550999",
      capabilities: { sms: true, voice: true },
    });

    await expect(service.send(context, "external-1", "SMS")).resolves.toEqual(
      expect.objectContaining({ sent: true, method: "SMS", expiresAt: expect.any(Date) }),
    );

    expect(repository.reserveVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        id: "external-1",
        method: "SMS",
        codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(repository.reserveVerification.mock.calls[0][0].codeHash).toHaveLength(64);
    expect(provider.verifyNumber).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+14165550123",
        from: "+14165550999",
        code: expect.stringMatching(/^\d{6}$/),
        method: "SMS",
      }),
    );
    expect(repository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "external_number.otp_sent" }),
    );
  });

  it("fails safely when the selected sender lacks the requested capability", async () => {
    repository.findById.mockResolvedValue(externalNumber());
    repository.findVerificationSender.mockResolvedValue({
      id: "phone-1",
      phoneNumber: "+14165550999",
      capabilities: { sms: false, voice: true },
    });

    await expect(service.send(context, "external-1", "SMS")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.reserveVerification).not.toHaveBeenCalled();
    expect(provider.verifyNumber).not.toHaveBeenCalled();
  });

  it("marks verification failed if Twilio rejects OTP delivery", async () => {
    repository.findById.mockResolvedValue(externalNumber());
    repository.findVerificationSender.mockResolvedValue({
      id: "phone-1",
      phoneNumber: "+14165550999",
      capabilities: { sms: true },
    });
    provider.verifyNumber.mockRejectedValue(new Error("twilio unavailable"));

    await expect(service.send(context, "external-1", "SMS")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.markVerificationFailed).toHaveBeenCalledWith("org-1", "external-1");
    expect(repository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "external_number.otp_delivery_failed" }),
    );
  });

  it("verifies a valid code and clears the pending challenge", async () => {
    const code = "123456";
    repository.verificationRecord.mockResolvedValue(
      externalNumber({
        verificationCodeHash: hash("org-1", "external-1", code),
        verificationExpiresAt: new Date(Date.now() + 60_000),
        verificationAttempts: 0,
        status: "PENDING",
      }),
    );
    repository.markVerified.mockResolvedValue(true);

    await expect(service.verify(context, "external-1", code)).resolves.toEqual(
      expect.objectContaining({ verified: true, verifiedAt: expect.any(Date) }),
    );

    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        resourceType: "PHONE_VERIFICATION_ATTEMPTS",
      }),
    );
    expect(repository.markVerified).toHaveBeenCalledWith(
      "org-1",
      "external-1",
      hash("org-1", "external-1", code),
      expect.any(Date),
    );
    expect(repository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "external_number.otp_verified" }),
    );
  });

  it("increments attempts and rejects an invalid code", async () => {
    repository.verificationRecord.mockResolvedValue(
      externalNumber({
        verificationCodeHash: hash("org-1", "external-1", "123456"),
        verificationExpiresAt: new Date(Date.now() + 60_000),
        verificationAttempts: 1,
        status: "PENDING",
      }),
    );

    await expect(service.verify(context, "external-1", "111111")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.incrementVerificationAttempt).toHaveBeenCalledWith("org-1", "external-1");
    expect(repository.markVerified).not.toHaveBeenCalled();
  });
});

function externalNumber(overrides: Record<string, unknown> = {}) {
  return {
    id: "external-1",
    organizationId: "org-1",
    phoneNumber: "+14165550123",
    forwardingTargetPhoneNumberId: "phone-1",
    verificationMethod: "SMS",
    verificationCodeHash: null,
    verificationExpiresAt: null,
    verificationAttempts: 0,
    status: "PENDING",
    verifiedAt: null,
    ...overrides,
  };
}

function hash(organizationId: string, id: string, code: string) {
  return createHmac("sha256", "otp-secret").update(`${organizationId}:${id}:${code}`).digest("hex");
}
