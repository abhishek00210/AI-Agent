import { NotFoundException } from "@nestjs/common";
import { MemoryService } from "./memory.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("MemoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("queues memory generation only at 20-message intervals", async () => {
    const deps = createDependencies();
    deps.repository.countMessages.mockResolvedValue(20);
    deps.repository.latestMemory.mockResolvedValue(null);
    const service = createService(deps);

    const result = await service.maybeEnqueueRefresh(context, "conversation-1");

    expect(result).toEqual({ queued: true, messageCount: 20 });
    expect(deps.queue.enqueueRefresh).toHaveBeenCalledWith(
      {
        organizationId: "org-1",
        conversationId: "conversation-1",
        actorUserId: "user-1",
      },
      20,
    );
  });

  it("does not queue memory generation before the next interval", async () => {
    const deps = createDependencies();
    deps.repository.countMessages.mockResolvedValue(19);
    const service = createService(deps);

    const result = await service.maybeEnqueueRefresh(context, "conversation-1");

    expect(result).toEqual({ queued: false, messageCount: 19 });
    expect(deps.queue.enqueueRefresh).not.toHaveBeenCalled();
  });

  it("does not queue duplicate work for an already summarized threshold", async () => {
    const deps = createDependencies();
    deps.repository.countMessages.mockResolvedValue(40);
    deps.repository.latestMemory.mockResolvedValue(memoryFixture({ messageCount: 40 }));
    const service = createService(deps);

    const result = await service.maybeEnqueueRefresh(context, "conversation-1");

    expect(result).toEqual({ queued: false, messageCount: 40 });
    expect(deps.queue.enqueueRefresh).not.toHaveBeenCalled();
  });

  it("returns tenant-scoped memory, facts, history, and statistics", async () => {
    const deps = createDependencies();
    deps.repository.findConversation.mockResolvedValue({ id: "conversation-1" });
    deps.repository.latestMemory.mockResolvedValue(memoryFixture({ messageCount: 20 }));
    deps.repository.memoryHistory.mockResolvedValue([memoryFixture({ messageCount: 20 })]);
    deps.repository.listFacts.mockResolvedValue([factFixture()]);
    deps.repository.countMemoryUpdates.mockResolvedValue(1);
    deps.repository.countMessages.mockResolvedValue(24);
    deps.repository.tokenEstimate.mockResolvedValue({ _sum: { tokenCount: 1200 } });
    const service = createService(deps);

    const result = await service.getConversationMemory(context, "conversation-1");

    expect(deps.repository.findConversation).toHaveBeenCalledWith("org-1", "conversation-1");
    expect(result.summary?.messageCount).toBe(20);
    expect(result.facts).toHaveLength(1);
    expect(result.statistics.currentMessageCount).toBe(24);
    expect(result.statistics.memoryUpdates).toBe(1);
    expect(result.statistics.tokenSavingsEstimate).toBeGreaterThan(0);
  });

  it("deletes facts only by organization scope", async () => {
    const deps = createDependencies();
    deps.repository.deleteFact.mockResolvedValue({ count: 1 });
    const service = createService(deps);

    await expect(service.deleteFact(context, "fact-1")).resolves.toEqual({ success: true });

    expect(deps.repository.deleteFact).toHaveBeenCalledWith("org-1", "fact-1");
    expect(deps.repository.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-1",
        action: "memory.fact_deleted",
      }),
    );
  });

  it("throws not found when deleting a fact outside the tenant", async () => {
    const deps = createDependencies();
    deps.repository.deleteFact.mockResolvedValue({ count: 0 });
    const service = createService(deps);

    await expect(service.deleteFact(context, "fact-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new MemoryService(deps.repository as never, deps.generation as never, deps.queue as never);
}

function createDependencies() {
  return {
    repository: {
      findConversation: jest.fn(),
      latestMemory: jest.fn(),
      memoryHistory: jest.fn(),
      listFacts: jest.fn(),
      countMessages: jest.fn(),
      tokenEstimate: jest.fn(),
      countMemoryUpdates: jest.fn(),
      deleteFact: jest.fn(),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    generation: { generate: jest.fn() },
    queue: { enqueueRefresh: jest.fn().mockResolvedValue({}) },
  };
}

function memoryFixture(overrides: Partial<{ messageCount: number }> = {}) {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "memory-1",
    organizationId: "org-1",
    conversationId: "conversation-1",
    summary: "Customer wants appointment information.",
    messageCount: overrides.messageCount ?? 20,
    tokenEstimate: 300,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function factFixture() {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "fact-1",
    organizationId: "org-1",
    conversationId: "conversation-1",
    factType: "CONTACT",
    factKey: "phone",
    factValue: "+1 555 0100",
    confidence: 0.9,
    createdAt: now,
    updatedAt: now,
  };
}
