import { NotFoundException } from "@nestjs/common";
import { MessageService } from "./message.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("MessageService", () => {
  it("stores user messages and updates conversation activity", async () => {
    const dependencies = createDependencies();
    dependencies.conversations.findById.mockResolvedValue({ id: "conversation-1" });
    dependencies.messages.create.mockResolvedValue(messageFixture());

    const service = createService(dependencies);
    const result = await service.sendUserMessage(context, "conversation-1", {
      content: "Hello there",
    });

    expect(result.content).toBe("Hello there");
    expect(dependencies.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        conversationId: "conversation-1",
        senderType: "USER",
        messageType: "TEXT",
      }),
    );
    expect(dependencies.conversations.touch).toHaveBeenCalled();
  });

  it("rejects messages for conversations outside the tenant", async () => {
    const dependencies = createDependencies();
    dependencies.conversations.findById.mockResolvedValue(null);
    const service = createService(dependencies);

    await expect(
      service.sendUserMessage(context, "other-conversation", { content: "Nope" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createDependencies() {
  return {
    conversations: {
      findById: jest.fn(),
      touch: jest.fn().mockResolvedValue({ count: 1 }),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    messages: {
      create: jest.fn(),
      list: jest.fn(),
    },
  };
}

function createService(dependencies: ReturnType<typeof createDependencies>) {
  return new MessageService(
    dependencies.conversations as unknown as ConstructorParameters<typeof MessageService>[0],
    dependencies.messages as unknown as ConstructorParameters<typeof MessageService>[1],
  );
}

function messageFixture() {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "message-1",
    organizationId: "org-1",
    conversationId: "conversation-1",
    senderType: "USER",
    content: "Hello there",
    messageType: "TEXT",
    tokenCount: 2,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}
