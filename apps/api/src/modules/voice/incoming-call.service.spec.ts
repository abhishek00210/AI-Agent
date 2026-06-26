import { IncomingCallService } from "./incoming-call.service";

describe("IncomingCallService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates and routes an inbound call for an active number and agent", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(routeFixture());
    deps.calls.createInbound.mockResolvedValue(callFixture());
    const service = createService(deps);

    const result = await service.handle({
      CallSid: "CA123",
      From: "+14155551234",
      To: "+1 (555) 123-4567",
      Direction: "inbound",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(deps.routing.resolve).toHaveBeenCalledWith("+15551234567");
    expect(deps.calls.createInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        agentId: "agent-1",
        phoneNumberId: "phone-1",
        twilioCallSid: "CA123",
        callerNumber: "+14155551234",
        calledNumber: "+15551234567",
        metadata: expect.objectContaining({
          rawFrom: "+14155551234",
          callerIdSource: "twilio_from",
        }),
      }),
    );
    expect(deps.calls.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", action: "call.routed" }),
    );
    expect(deps.calls.updateStatus).toHaveBeenCalledWith("org-1", "call-1", "ROUTING");
    expect(result).toBe("<routing/>");
  });

  it("returns graceful TwiML when no routable number exists", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(null);
    deps.phoneNumbers.findByPhoneNumber.mockResolvedValue({
      id: "phone-1",
      organizationId: "org-1",
      deletedAt: null,
    });
    const service = createService(deps);

    const result = await service.handle({
      CallSid: "CA404",
      From: "+14155551234",
      To: "+15551234567",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(deps.calls.createInbound).not.toHaveBeenCalled();
    expect(deps.calls.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "call.routing_failed", organizationId: "org-1" }),
    );
    expect(result).toBe("<unavailable/>");
  });

  it("preserves the original caller ID for forwarded calls", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(routeFixture());
    deps.calls.createInbound.mockResolvedValue(callFixture());
    const service = createService(deps);

    await service.handle({
      CallSid: "CA_FORWARD",
      From: "+14165550100",
      To: "+15551234567",
      Direction: "inbound",
    });

    expect(deps.calls.createInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        callerNumber: "+14165550100",
        calledNumber: "+15551234567",
        metadata: expect.objectContaining({
          rawFrom: "+14165550100",
          callerIdSource: "twilio_from",
        }),
      }),
    );
  });

  it("routes outbound answered calls by the platform From number and preserves customer as caller", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(routeFixture());
    deps.calls.createOutbound.mockResolvedValue({ ...callFixture(), direction: "OUTBOUND" });
    const service = createService(deps);

    const result = await service.handle({
      CallSid: "CA_OUTBOUND",
      From: "+15551234567",
      To: "+14165550100",
      Direction: "outbound-api",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(deps.routing.resolve).toHaveBeenCalledWith("+15551234567");
    expect(deps.calls.createOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        twilioCallSid: "CA_OUTBOUND",
        callerNumber: "+14165550100",
        calledNumber: "+15551234567",
        metadata: expect.objectContaining({
          outbound: true,
          rawFrom: "+15551234567",
          rawTo: "+14165550100",
          callerIdSource: "twilio_to_outbound_customer",
        }),
      }),
    );
    expect(deps.calls.createInbound).not.toHaveBeenCalled();
    expect(result).toBe("<routing/>");
  });

  it("blocks carrier forwarding loops before call persistence", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(routeFixture());
    deps.phoneNumbers.findForwardingLoopSource.mockResolvedValue({
      id: "external-1",
      phoneNumber: "+14165550123",
      status: "ACTIVE",
    });
    const service = createService(deps);

    const result = await service.handle({
      CallSid: "CA_LOOP",
      From: "+14165550123",
      To: "+15551234567",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(deps.calls.createInbound).not.toHaveBeenCalled();
    expect(deps.calls.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "call.forwarding_loop_blocked",
        organizationId: "org-1",
        metadata: expect.objectContaining({
          externalPhoneNumberId: "external-1",
          callerNumber: "+14165550123",
          calledNumber: "+15551234567",
        }),
      }),
    );
    expect(result).toBe("<unavailable/>");
  });

  it("blocks self-forwarding loops when caller and Twilio target are the same", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(routeFixture());
    const service = createService(deps);

    const result = await service.handle({
      CallSid: "CA_SELF_LOOP",
      From: "+15551234567",
      To: "+15551234567",
    });

    expect(deps.phoneNumbers.findForwardingLoopSource).toHaveBeenCalledWith(
      expect.objectContaining({ callerNumber: "+15551234567" }),
    );
    expect(deps.calls.createInbound).not.toHaveBeenCalled();
    expect(result).toBe("<unavailable/>");
  });

  it("rejects a routed call before persistence when billing denies voice access", async () => {
    const deps = createDependencies();
    deps.routing.resolve.mockResolvedValue(routeFixture());
    deps.gates.canReceiveCalls.mockResolvedValue(false);
    const service = createService(deps);

    await expect(
      service.handle({ CallSid: "CA_DENIED", From: "+14155551234", To: "+15551234567" }),
    ).resolves.toBe("<unavailable/>");
    expect(deps.calls.createInbound).not.toHaveBeenCalled();
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new IncomingCallService(
    deps.routing as never,
    deps.phoneNumbers as never,
    deps.calls as never,
    deps.twiml as never,
    {
      now: jest.fn(() => performance.now()),
      observe: jest.fn(),
      increment: jest.fn(),
    } as never,
    deps.gates as never,
  );
}

function createDependencies() {
  return {
    routing: { resolve: jest.fn() },
    phoneNumbers: {
      findByPhoneNumber: jest.fn(),
      findForwardingLoopSource: jest.fn().mockResolvedValue(null),
    },
    calls: {
      createInbound: jest.fn(),
      createOutbound: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue({ count: 1 }),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    twiml: {
      routing: jest.fn().mockReturnValue("<routing/>"),
      unavailable: jest.fn().mockReturnValue("<unavailable/>"),
    },
    gates: {
      canReceiveCalls: jest.fn().mockResolvedValue(true),
      canUseRealtimeVoice: jest.fn().mockResolvedValue(true),
    },
  };
}

function routeFixture() {
  return {
    id: "phone-1",
    organizationId: "org-1",
    agentId: "agent-1",
    phoneNumber: "+15551234567",
    agent: { id: "agent-1", name: "Reception", status: "ACTIVE", language: "English" },
  };
}

function callFixture() {
  const now = new Date("2026-06-09T10:00:00.000Z");
  return {
    id: "call-1",
    organizationId: "org-1",
    agentId: "agent-1",
    phoneNumberId: "phone-1",
    twilioCallSid: "CA123",
    callerNumber: "+14155551234",
    calledNumber: "+15551234567",
    direction: "INBOUND",
    status: "RINGING",
    startedAt: now,
    endedAt: null,
    durationSeconds: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    agent: { id: "agent-1", name: "Reception", status: "ACTIVE" },
    phoneNumber: { id: "phone-1", phoneNumber: "+15551234567", friendlyName: "Main" },
  };
}
