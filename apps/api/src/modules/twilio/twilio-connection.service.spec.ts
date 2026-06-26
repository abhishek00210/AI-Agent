import { TwilioConnectionService } from "./twilio-connection.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("TwilioConnectionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies and stores a tenant-scoped Twilio connection", async () => {
    const deps = createDependencies();
    deps.provider.validateConnection.mockResolvedValue({
      accountSid: "AC123",
      friendlyName: "Main Twilio",
      status: "active",
    });
    deps.connections.upsert.mockResolvedValue(connectionFixture());
    const service = createService(deps);

    const result = await service.verify(context);

    expect(deps.connections.upsert).toHaveBeenCalledWith({
      organizationId: "org-1",
      accountSid: "AC123",
      friendlyName: "Main Twilio",
      status: "CONNECTED",
    });
    expect(deps.connections.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "twilio.connected",
      }),
    );
    expect(result.connected).toBe(true);
  });

  it("returns disconnected status when no tenant connection exists", async () => {
    const deps = createDependencies();
    deps.provider.isConfigured.mockReturnValue(true);
    deps.connections.findCurrent.mockResolvedValue(null);
    const service = createService(deps);

    const result = await service.status(context);

    expect(result).toMatchObject({
      connected: false,
      configured: true,
      status: "DISCONNECTED",
    });
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new TwilioConnectionService(deps.provider as never, deps.connections as never);
}

function createDependencies() {
  return {
    provider: {
      validateConnection: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    },
    connections: {
      upsert: jest.fn(),
      findCurrent: jest.fn(),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
  };
}

function connectionFixture() {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "connection-1",
    organizationId: "org-1",
    accountSid: "AC123",
    friendlyName: "Main Twilio",
    status: "CONNECTED",
    createdAt: now,
    updatedAt: now,
  };
}
