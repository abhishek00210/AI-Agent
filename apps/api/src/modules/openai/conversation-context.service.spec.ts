import { NotFoundException } from "@nestjs/common";
import { ConversationContextService } from "./conversation-context.service";

describe("ConversationContextService", () => {
  it("loads tenant-scoped conversation context with the latest 20 non-deleted messages", async () => {
    const messages = [
      {
        id: "message-new",
        senderType: "USER",
        content: "Newest",
        createdAt: new Date("2026-06-08T12:02:00Z"),
      },
      {
        id: "message-old",
        senderType: "ASSISTANT",
        content: "Oldest",
        createdAt: new Date("2026-06-08T12:01:00Z"),
      },
    ];
    const prisma = createPrismaMock({
      id: "conversation-1",
      organizationId: "org-1",
      agentId: "agent-1",
      agent: { knowledgeBases: [] },
      messages,
    });
    const service = new ConversationContextService(prisma as never);

    const result = await service.load({
      organizationId: "org-1",
      conversationId: "conversation-1",
      agentId: "agent-1",
    });

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "conversation-1",
          organizationId: "org-1",
          agentId: "agent-1",
          deletedAt: null,
        },
        include: expect.objectContaining({
          agent: {
            include: {
              knowledgeBases: {
                where: { organizationId: "org-1", deletedAt: null },
                select: { id: true, name: true },
              },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        }),
      }),
    );
    expect(result.messages.map((message) => message.id)).toEqual(["message-old", "message-new"]);
  });

  it("returns not found for conversations outside the tenant or agent scope", async () => {
    const prisma = createPrismaMock(null);
    const service = new ConversationContextService(prisma as never);

    await expect(
      service.load({
        organizationId: "org-1",
        conversationId: "conversation-1",
        agentId: "agent-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createPrismaMock(result: unknown) {
  return {
    conversation: {
      findFirst: jest.fn().mockResolvedValue(result),
    },
  };
}
