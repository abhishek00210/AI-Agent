import { OutboundCallService } from "./outbound-call.service";

describe("OutboundCallService", () => {
  const prisma = {
    outboundCall: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    agent: {
      findFirst: jest.fn(),
    },
    customerProfile: {
      findFirst: jest.fn(),
    },
    phoneNumber: {
      findFirst: jest.fn(),
    },
    call: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    callSummary: {
      findUnique: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  };
  const provider = {
    startCall: jest.fn(),
    cancelCall: jest.fn(),
    leaveVoicemailOrHangUp: jest.fn(),
  };
  const customers = { resolveCustomer: jest.fn() };
  const timeline = { recordEvent: jest.fn() };
  const usage = { increment: jest.fn() };
  const analytics = { record: jest.fn() };
  const service = new OutboundCallService(
    prisma as never,
    provider as never,
    customers as never,
    timeline as never,
    usage as never,
    analytics as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("starts a real provider outbound call from a CALL automation execution", async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: "lead-1", agentId: "agent-1", metadata: {}, status: "NEW" });
    prisma.phoneNumber.findFirst.mockResolvedValue({ id: "phone-1", phoneNumber: "+15551234567" });
    customers.resolveCustomer.mockResolvedValue({ id: "customer-1" });
    prisma.outboundCall.count.mockResolvedValue(0);
    prisma.outboundCall.create.mockResolvedValue(outbound({ status: "PENDING" }));
    provider.startCall.mockResolvedValue({ providerCallSid: "CA_OUT", status: "queued" });
    prisma.call.upsert.mockResolvedValue({ id: "call-1" });
    prisma.outboundCall.update.mockResolvedValue(outbound({ status: "DIALING", providerCallSid: "CA_OUT", callId: "call-1" }));

    const result = await service.startFromAutomation(execution() as never);

    expect(prisma.outboundCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          customerProfileId: "customer-1",
          leadId: "lead-1",
          agentId: "agent-1",
          reasonType: "LEAD_FOLLOW_UP",
          reasonDescription: "Follow up with a new lead.",
        }),
      }),
    );
    expect(provider.startCall).toHaveBeenCalledWith({
      to: "+14165550100",
      from: "+15551234567",
    });
    expect(prisma.call.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          twilioCallSid: "CA_OUT",
          callerNumber: "+14165550100",
          calledNumber: "+15551234567",
          direction: "OUTBOUND",
          metadata: expect.objectContaining({
            outboundCallId: "outbound-1",
            reasonType: "LEAD_FOLLOW_UP",
          }),
        }),
      }),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "OUTBOUND_CALLS" }),
    );
    expect(result.providerCallSid).toBe("CA_OUT");
  });

  it("creates a tenant-scoped manual outbound call", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1", phone: "+14165550100" });
    prisma.agent.findFirst.mockResolvedValue({ id: "agent-1" });
    prisma.phoneNumber.findFirst.mockResolvedValue({ id: "phone-1", phoneNumber: "+15551234567" });
    prisma.outboundCall.count.mockResolvedValue(0);
    prisma.outboundCall.create.mockResolvedValue(outbound({ leadId: null, automationExecutionId: null }));
    provider.startCall.mockResolvedValue({ providerCallSid: "CA_MANUAL", status: "queued" });
    prisma.call.upsert.mockResolvedValue({ id: "call-manual" });
    prisma.outboundCall.update.mockResolvedValue(
      outbound({ leadId: null, automationExecutionId: null, callId: "call-manual", providerCallSid: "CA_MANUAL", status: "DIALING" }),
    );

    const result = await service.create(
      { organizationId: "org-1" } as never,
      {
        customerProfileId: "customer-1",
        agentId: "agent-1",
        reasonType: "MANUAL_CALL",
        reasonDescription: "Manual customer follow-up.",
      },
    );

    expect(prisma.customerProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "customer-1", organizationId: "org-1" } }),
    );
    expect(provider.startCall).toHaveBeenCalledWith({ to: "+14165550100", from: "+15551234567" });
    expect(result.providerCallSid).toBe("CA_MANUAL");
  });

  it("cancels a non-terminal provider call idempotently", async () => {
    prisma.outboundCall.findFirst.mockResolvedValue(
      outbound({ status: "RINGING", providerCallSid: "CA_OUT", callId: "call-1" }),
    );
    prisma.outboundCall.update.mockResolvedValue(
      outbound({ status: "CANCELLED", providerCallSid: "CA_OUT", callId: "call-1", endedAt: new Date() }),
    );

    const result = await service.cancel({ organizationId: "org-1" } as never, "outbound-1");

    expect(provider.cancelCall).toHaveBeenCalledWith("CA_OUT");
    expect(prisma.call.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "call-1", organizationId: "org-1" } }),
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("marks voicemail and asks the provider to hang up by default", async () => {
    prisma.outboundCall.findFirst.mockResolvedValue(outbound({ status: "RINGING", providerCallSid: "CA_OUT", callId: "call-1" }));
    prisma.outboundCall.update.mockResolvedValue(outbound({ status: "VOICEMAIL", providerCallSid: "CA_OUT", callId: "call-1" }));
    prisma.appointment.findFirst.mockResolvedValue(null);
    prisma.callSummary.findUnique.mockResolvedValue(null);

    await service.handleStatusCallback({
      providerCallSid: "CA_OUT",
      callStatus: "in-progress",
      answeredBy: "machine_start",
    });

    expect(provider.leaveVoicemailOrHangUp).toHaveBeenCalledWith(
      expect.objectContaining({ providerCallSid: "CA_OUT", mode: "HANG_UP" }),
    );
    expect(timeline.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "OUTBOUND_CALL_FAILED" }),
    );
  });
});

function execution() {
  return {
    id: "execution-1",
    organizationId: "org-1",
    workflowId: "workflow-1",
    ruleId: "rule-1",
    customerProfileId: "customer-1",
    triggerType: "NEW_LEAD",
    actionType: "CALL",
    reasonType: "LEAD_FOLLOW_UP",
    reasonDescription: "Follow up with a new lead.",
    scheduledFor: new Date("2026-06-24T10:00:00.000Z"),
    metadata: { sourceEntityType: "Lead", sourceEntityId: "lead-1", triggerMetadata: { agentId: "agent-1" } },
    workflow: { assignedAgentId: null },
    customerProfile: {
      id: "customer-1",
      contactId: "contact-1",
      name: "Jane Lead",
      phone: "+14165550100",
      email: "jane@example.com",
    },
  };
}

function outbound(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-24T10:00:00.000Z");
  return {
    id: "outbound-1",
    organizationId: "org-1",
    customerProfileId: "customer-1",
    leadId: "lead-1",
    callId: null,
    agentId: "agent-1",
    phoneNumberId: "phone-1",
    automationExecutionId: "execution-1",
    reasonType: "LEAD_FOLLOW_UP",
    reasonDescription: "Follow up with a new lead.",
    status: "PENDING",
    attemptNumber: 1,
    scheduledAt: now,
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    appointmentBooked: false,
    qualified: false,
    summaryId: null,
    recordingId: null,
    transcriptId: null,
    provider: "TWILIO",
    providerCallSid: null,
    lastError: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    customerProfile: { id: "customer-1", name: "Jane Lead", phone: "+14165550100", email: "jane@example.com" },
    lead: { id: "lead-1", status: "NEW", score: 0, metadata: {} },
    agent: { id: "agent-1", name: "Reception", status: "ACTIVE" },
    call: null,
    summary: null,
    recording: null,
    transcript: null,
    ...overrides,
  };
}
