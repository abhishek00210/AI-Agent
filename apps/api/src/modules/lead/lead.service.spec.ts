import { LeadService } from "./lead.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("LeadService", () => {
  it("captures leads through the contact resolver and scores by source", async () => {
    const deps = createDependencies();
    const service = createService(deps);

    await service.capture(context, {
      name: "Jane Customer",
      phone: "+1 (555) 123-4567",
      email: "JANE@EXAMPLE.COM",
      source: "VOICE",
    });

    expect(deps.contacts.resolve).toHaveBeenCalledWith(expect.objectContaining({ name: "Jane Customer" }));
    expect(deps.repository.upsertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "contact-1",
        source: "VOICE",
        scoreDelta: 20,
      }),
    );
  });

  it("keeps one lead while creating a timeline event for every channel interaction", async () => {
    const deps = createDependencies();
    const service = createService(deps);

    await service.capture(context, { name: "Jane Customer", email: "jane@example.com", source: "VOICE" });
    await service.capture(context, { name: "Jane Customer", email: "jane@example.com", source: "WIDGET" });
    await service.capture(context, { name: "Jane Customer", email: "jane@example.com", source: "CHAT" });

    expect(deps.repository.upsertLead).toHaveBeenCalledTimes(3);
    expect(deps.repository.upsertLead).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "contact-1" }),
    );
    expect(deps.timeline.create).toHaveBeenCalledTimes(3);
    expect(deps.communicationThreads.recordMessage).toHaveBeenCalledTimes(3);
    expect(deps.timeline.create.mock.calls.map(([event]) => event.type)).toEqual([
      "CALL",
      "CHAT",
      "CHAT",
    ]);
  });

  it("soft deletes leads without touching linked call or conversation records", async () => {
    const deps = createDependencies();
    deps.repository.findLeadById.mockResolvedValue(lead());
    const service = createService(deps);

    await service.delete(context, "lead-1");

    expect(deps.repository.softDeleteLead).toHaveBeenCalledWith("org-1", "lead-1", "user-1");
  });
});

function createDependencies() {
  return {
    contacts: {
      resolve: jest.fn().mockResolvedValue({ id: "contact-1" }),
    },
    repository: {
      upsertLead: jest.fn().mockResolvedValue(lead()),
      findLeadById: jest.fn(),
      softDeleteLead: jest.fn().mockResolvedValue(lead()),
      createAuditEvent: jest.fn().mockResolvedValue({ id: "audit-1" }),
    },
    timeline: {
      create: jest.fn().mockResolvedValue({ id: "timeline-1" }),
    },
    communicationThreads: {
      recordMessage: jest.fn().mockResolvedValue({ id: "thread-1" }),
    },
  };
}

function createService(deps: ReturnType<typeof createDependencies>) {
  return new LeadService(
    deps.repository as never,
    deps.contacts as never,
    deps.timeline as never,
    deps.communicationThreads as never,
  );
}

function lead() {
  return {
    id: "lead-1",
    organizationId: "org-1",
    contactId: "contact-1",
    conversationId: "conversation-1",
    callId: "call-1",
    agentId: "agent-1",
    source: "VOICE",
    status: "NEW",
    score: 20,
    lastInteractionAt: new Date(),
    notes: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}
