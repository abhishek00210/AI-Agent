import { ConversationAnalyticsService } from "./conversation-analytics.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("ConversationAnalyticsService", () => {
  it("uses tenant-scoped and soft-delete-aware analytics queries", async () => {
    const prisma = {
      conversation: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      message: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { tokenCount: 0 } }),
      },
    };
    const service = new ConversationAnalyticsService(prisma as never);

    await service.overview(context);

    expect(prisma.conversation.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1", deletedAt: null },
    });
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", deletedAt: null },
        select: expect.objectContaining({
          _count: { select: { messages: { where: { deletedAt: null } } } },
        }),
      }),
    );
    expect(prisma.message.aggregate).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        deletedAt: null,
        conversation: { deletedAt: null },
      },
      _sum: { tokenCount: true },
    });
  });
});
