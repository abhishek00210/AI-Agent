import { CallRepository } from "./call.repository";

describe("CallRepository", () => {
  it("uses the globally unique CallSid as the atomic upsert key", async () => {
    const prisma = {
      call: {
        upsert: jest.fn().mockResolvedValue(callFixture()),
      },
    };
    const repository = new CallRepository(prisma as never);
    const input = {
      organizationId: "org-1",
      agentId: "agent-1",
      phoneNumberId: "phone-1",
      twilioCallSid: "CA123",
      callerNumber: "+14155551234",
      calledNumber: "+15551234567",
      metadata: {},
    };

    const [first, second] = await Promise.all([
      repository.createInbound(input),
      repository.createInbound(input),
    ]);

    expect(prisma.call.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.call.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { twilioCallSid: "CA123" } }),
    );
    expect(prisma.call.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { twilioCallSid: "CA123" } }),
    );
    expect(first.id).toBe(second.id);
  });
});

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
