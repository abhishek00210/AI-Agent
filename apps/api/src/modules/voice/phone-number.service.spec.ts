import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PhoneNumberService } from "./phone-number.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("PhoneNumberService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("syncs Twilio numbers into the current tenant", async () => {
    const deps = createDependencies();
    deps.telephonyProvider.listNumbers.mockResolvedValue([
      {
        providerSid: "PN123",
        phoneNumber: "+1 (555) 123-4567",
        friendlyName: "Main Line",
        country: "US",
        capabilities: { voice: true, sms: true, mms: false },
        voiceWebhookUrl: null,
        smsWebhookUrl: null,
      },
    ]);
    deps.phoneNumbers.upsertFromProvider.mockResolvedValue(phoneNumberFixture());
    const service = createService(deps);

    const result = await service.sync(context);

    expect(deps.phoneNumbers.upsertFromProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        phoneNumber: "+15551234567",
        twilioSid: "PN123",
        voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/voice",
        smsWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/sms",
      }),
    );
    expect(deps.phoneNumbers.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "phone_number.synced",
      }),
    );
    expect(result.total).toBe(1);
  });

  it("blocks syncing a phone number that already belongs to another organization", async () => {
    const deps = createDependencies();
    deps.telephonyProvider.listNumbers.mockResolvedValue([
      {
        providerSid: "PN123",
        phoneNumber: "+15551234567",
        friendlyName: "Main Line",
        country: "US",
        capabilities: { voice: true, sms: true, mms: false },
        voiceWebhookUrl: null,
        smsWebhookUrl: null,
      },
    ]);
    deps.phoneNumbers.findByPhoneNumber.mockResolvedValue({
      id: "phone-other",
      organizationId: "org-2",
      deletedAt: null,
    });
    const service = createService(deps);

    await expect(service.sync(context)).rejects.toBeInstanceOf(ConflictException);
    expect(deps.phoneNumbers.upsertFromProvider).not.toHaveBeenCalled();
  });

  it("normalizes Twilio North American formatted numbers during sync", async () => {
    const deps = createDependencies();
    deps.telephonyProvider.listNumbers.mockResolvedValue([
      {
        providerSid: "PN123",
        phoneNumber: "415-555-1234",
        friendlyName: "Main Line",
        country: "US",
        capabilities: { voice: true, sms: true, mms: false },
        voiceWebhookUrl: null,
        smsWebhookUrl: null,
      },
    ]);
    deps.phoneNumbers.upsertFromProvider.mockResolvedValue(phoneNumberFixture());
    const service = createService(deps);

    await service.sync(context);

    expect(deps.phoneNumbers.upsertFromProvider).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: "+14155551234" }),
    );
  });

  it("rejects invalid phone numbers during sync", async () => {
    const deps = createDependencies();
    deps.telephonyProvider.listNumbers.mockResolvedValue([
      {
        providerSid: "PN123",
        phoneNumber: "12345",
        friendlyName: "Main Line",
        country: "US",
        capabilities: { voice: true, sms: true, mms: false },
        voiceWebhookUrl: null,
        smsWebhookUrl: null,
      },
    ]);
    const service = createService(deps);

    await expect(service.sync(context)).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.phoneNumbers.upsertFromProvider).not.toHaveBeenCalled();
  });

  it("assigns only agents from the same tenant", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture());
    deps.phoneNumbers.agentExists.mockResolvedValue({
      id: "agent-1",
      name: "Reception",
      status: "ACTIVE",
      language: "English",
    });
    deps.phoneNumbers.assignAgent.mockResolvedValue({ count: 1 });
    const updated = phoneNumberFixture({ agentId: "agent-1" });
    deps.phoneNumbers.findById
      .mockResolvedValueOnce(phoneNumberFixture())
      .mockResolvedValueOnce(updated);
    const service = createService(deps);

    const result = await service.assignAgent(context, "phone-1", { agentId: "agent-1" });

    expect(deps.phoneNumbers.agentExists).toHaveBeenCalledWith("org-1", "agent-1");
    expect(deps.telephonyProvider.assignNumber).toHaveBeenCalledWith("PN123", {
      voiceWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/voice",
      smsWebhookUrl: "https://api.example.com/api/v1/webhooks/twilio/sms",
    });
    expect(deps.phoneNumbers.assignAgent).toHaveBeenCalledWith("org-1", "phone-1", "agent-1");
    expect(result.agentId).toBe("agent-1");
  });

  it("rejects assignment for agents outside the tenant", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture());
    deps.phoneNumbers.agentExists.mockResolvedValue(null);
    const service = createService(deps);

    await expect(
      service.assignAgent(context, "phone-1", { agentId: "other-agent" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.phoneNumbers.assignAgent).not.toHaveBeenCalled();
  });

  it("rejects assignment for inactive agents", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture());
    deps.phoneNumbers.agentExists.mockResolvedValue(null);
    const service = createService(deps);

    await expect(
      service.assignAgent(context, "phone-1", { agentId: "inactive-agent" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.phoneNumbers.assignAgent).not.toHaveBeenCalled();
  });

  it("unassigns and disables tenant-owned phone numbers", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture({ agentId: "agent-1" }));
    deps.phoneNumbers.unassignAgent.mockResolvedValue({ count: 1 });
    deps.phoneNumbers.updateStatus.mockResolvedValue({ count: 1 });
    const service = createService(deps);

    await service.unassign(context, "phone-1");
    await service.disable(context, "phone-1");

    expect(deps.phoneNumbers.unassignAgent).toHaveBeenCalledWith("org-1", "phone-1");
    expect(deps.telephonyProvider.disableNumber).toHaveBeenCalledWith("PN123");
    expect(deps.phoneNumbers.updateStatus).toHaveBeenCalledWith("org-1", "phone-1", "INACTIVE");
  });

  it("does not touch existing calls when disabling a number", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findById.mockResolvedValue(phoneNumberFixture({ agentId: "agent-1" }));
    deps.phoneNumbers.updateStatus.mockResolvedValue({ count: 1 });
    const service = createService(deps);

    await service.disable(context, "phone-1");

    expect(deps.phoneNumbers.updateStatus).toHaveBeenCalledWith("org-1", "phone-1", "INACTIVE");
    expect(deps.calls.updateStatus).not.toHaveBeenCalled();
  });

  it("only returns active assigned numbers as routable", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findRoutableByPhoneNumber.mockResolvedValue(
      phoneNumberFixture({ status: "ACTIVE", agentId: "agent-1" }),
    );
    const service = createService(deps);

    const result = await service.getRoutableByPhoneNumber("+1 (555) 123-4567");

    expect(deps.phoneNumbers.findRoutableByPhoneNumber).toHaveBeenCalledWith("+15551234567");
    expect(result?.status).toBe("ACTIVE");
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new PhoneNumberService(
    deps.phoneNumbers as never,
    deps.telephony as never,
    deps.webhookUrls as never,
    { invalidate: jest.fn() } as never,
  );
}

function createDependencies() {
  return {
    phoneNumbers: {
      upsertFromProvider: jest.fn(),
      findByPhoneNumber: jest.fn().mockResolvedValue(null),
      findRoutableByPhoneNumber: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      agentExists: jest.fn(),
      assignAgent: jest.fn(),
      unassignAgent: jest.fn(),
      updateStatus: jest.fn(),
      stats: jest.fn(),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    calls: {
      updateStatus: jest.fn(),
    },
    telephonyProvider: {
      name: "TWILIO",
      listNumbers: jest.fn(),
      assignNumber: jest.fn().mockResolvedValue(undefined),
      disableNumber: jest.fn().mockResolvedValue(undefined),
    },
    webhookUrls: {
      voiceUrl: jest.fn().mockReturnValue("https://api.example.com/api/v1/webhooks/twilio/voice"),
      smsUrl: jest.fn().mockReturnValue("https://api.example.com/api/v1/webhooks/twilio/sms"),
    },
    get telephony() {
      return {
        resolve: jest.fn(() => this.telephonyProvider),
        byName: jest.fn(() => this.telephonyProvider),
      };
    },
  };
}

function phoneNumberFixture(overrides: Partial<{ agentId: string | null; status: string }> = {}) {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "phone-1",
    organizationId: "org-1",
    agentId: overrides.agentId ?? null,
    phoneNumber: "+15551234567",
    friendlyName: "Main Line",
    country: "US",
    capabilities: { voice: true, sms: true, mms: false },
    provider: "TWILIO",
    status: overrides.status ?? "UNASSIGNED",
    twilioSid: "PN123",
    voiceWebhookUrl: null,
    smsWebhookUrl: null,
    createdAt: now,
    updatedAt: now,
    agent: null,
  };
}
