import { NotFoundException } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import { ConversationChannelDto } from "./dto/conversation.dto";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("ConversationService", () => {
  it("creates a tenant-scoped conversation for an owned agent", async () => {
    const dependencies = createDependencies();
    dependencies.conversations.agentExists.mockResolvedValue({ id: "agent-1", name: "Reception" });
    dependencies.conversations.create.mockResolvedValue(conversationFixture());

    const service = createService(dependencies);
    const result = await service.create(context, {
      agentId: "agent-1",
      channel: ConversationChannelDto.WEB_CHAT,
    });

    expect(result.conversationId).toBe("conversation-1");
    expect(dependencies.conversations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        agentId: "agent-1",
        channel: "WEB_CHAT",
      }),
    );
    expect(dependencies.conversations.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "conversation.created",
      }),
    );
  });

  it("returns complete non-deleted message history for a scoped conversation", async () => {
    const dependencies = createDependencies();
    dependencies.conversations.findById.mockResolvedValue({
      ...conversationFixture(),
      messages: [
        messageFixture("message-1", "USER", "Hi"),
        messageFixture("message-2", "ASSISTANT", "Hello"),
        messageFixture("message-3", "SYSTEM", "Conversation opened"),
      ],
    });
    dependencies.messages.tokenSumByConversation.mockResolvedValue({ _sum: { tokenCount: 9 } });
    const service = createService(dependencies);

    const result = await service.getById(context, "conversation-1");

    expect(result.messages.map((message) => message.senderType)).toEqual([
      "USER",
      "ASSISTANT",
      "SYSTEM",
    ]);
    expect(result.statistics.messageCount).toBe(3);
  });

  it("rejects conversations for agents outside the tenant", async () => {
    const dependencies = createDependencies();
    dependencies.conversations.agentExists.mockResolvedValue(null);
    const service = createService(dependencies);

    await expect(
      service.create(context, { agentId: "other-agent", channel: ConversationChannelDto.WEB_CHAT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createDependencies() {
  return {
    conversations: {
      agentExists: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      softDelete: jest.fn(),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    messages: {
      tokenSumByConversation: jest.fn(),
    },
  };
}

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new ConversationService(
    dependencies.conversations as unknown as ConstructorParameters<typeof ConversationService>[0],
    dependencies.messages as unknown as ConstructorParameters<typeof ConversationService>[1],
  );
}

function conversationFixture() {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "conversation-1",
    organizationId: "org-1",
    agentId: "agent-1",
    visitorId: null,
    sessionId: "session-1",
    channel: "WEB_CHAT",
    status: "ACTIVE",
    startedAt: now,
    lastMessageAt: null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    agent: { id: "agent-1", name: "Reception", status: "ACTIVE" },
    _count: { messages: 0 },
  };
}

function messageFixture(id: string, senderType: "USER" | "ASSISTANT" | "SYSTEM", content: string) {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id,
    organizationId: "org-1",
    conversationId: "conversation-1",
    senderType,
    content,
    messageType: "TEXT",
    tokenCount: 3,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}
