import { ForwardingTestService } from "./forwarding-test.service";

describe("ForwardingTestService", () => {
  const repository = {
    startTest: jest.fn(),
    findPendingTest: jest.fn(),
    activateFromTest: jest.fn(),
    createAudit: jest.fn(),
  };
  const usage = { increment: jest.fn() };
  const service = new ForwardingTestService(repository as never, usage as never);
  const context = {
    organizationId: "org-1",
    userId: "user-1",
    email: "owner@example.com",
    role: "OWNER" as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it("starts a bounded forwarding test without marking the number active", async () => {
    repository.startTest.mockResolvedValue(record({ status: "VERIFIED", activatedAt: null }));

    const result = await service.start(context, "external-1");

    expect(repository.startTest).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        id: "external-1",
        testSessionHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        resourceType: "PHONE_FORWARDING_TESTS",
      }),
    );
    expect(result.status).toBe("WAITING_FOR_CALL");
    expect(result.externalNumber.status).toBe("VERIFIED");
    expect(result.externalNumber.forwardingConfirmedAt).toBeNull();
  });

  it("activates only after a forwarded call reaches the assigned Twilio target", async () => {
    const testStartedAt = new Date("2026-06-22T10:00:00.000Z");
    repository.findPendingTest.mockResolvedValue(record({ testStartedAt }));
    repository.activateFromTest.mockResolvedValue({ count: 1 });

    const result = await service.confirmForwardedCall({
      organizationId: "org-1",
      forwardingTargetPhoneNumberId: "phone-1",
      assignedAgentId: "agent-1",
      callId: "call-1",
    });

    expect(repository.findPendingTest).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        forwardingTargetPhoneNumberId: "phone-1",
        assignedAgentId: "agent-1",
      }),
    );
    expect(repository.activateFromTest).toHaveBeenCalledWith(
      "org-1",
      "external-1",
      expect.any(Date),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "PHONE_FORWARDING_ACTIVATIONS",
        idempotencyKey: `external-number:activation:external-1:${testStartedAt.getTime()}`,
      }),
    );
    expect(repository.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "external_number.forwarding_confirmed",
        entityId: "external-1",
        metadata: expect.objectContaining({ callId: "call-1", assignedAgentId: "agent-1" }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: "external-1",
        status: "ACTIVE",
        forwardingConfirmedAt: expect.any(Date),
      }),
    );
  });

  it("does not audit or count usage when no pending test matches the call", async () => {
    repository.findPendingTest.mockResolvedValue(null);

    await expect(
      service.confirmForwardedCall({
        organizationId: "org-1",
        forwardingTargetPhoneNumberId: "phone-1",
        assignedAgentId: "agent-1",
        callId: "call-1",
      }),
    ).resolves.toBeNull();

    expect(repository.activateFromTest).not.toHaveBeenCalled();
    expect(usage.increment).not.toHaveBeenCalled();
    expect(repository.createAudit).not.toHaveBeenCalled();
  });
});

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "external-1",
    organizationId: "org-1",
    phoneNumber: "+14165550123",
    countryCode: "CA",
    status: "VERIFIED",
    assignedAgentId: "agent-1",
    assignedAgent: { id: "agent-1", name: "Front Desk", status: "ACTIVE" },
    forwardingTargetPhoneNumberId: "phone-1",
    forwardingTargetNumber: "+14165550999",
    verificationMethod: "SMS",
    verificationExpiresAt: null,
    verifiedAt: new Date("2026-06-22T09:00:00.000Z"),
    activatedAt: null,
    lastTestCallAt: null,
    forwardingConfirmedAt: null,
    testStartedAt: new Date("2026-06-22T10:00:00.000Z"),
    testExpiresAt: new Date("2026-06-22T10:10:00.000Z"),
    disabledAt: null,
    createdAt: new Date("2026-06-22T08:00:00.000Z"),
    updatedAt: new Date("2026-06-22T08:00:00.000Z"),
    ...overrides,
  };
}
