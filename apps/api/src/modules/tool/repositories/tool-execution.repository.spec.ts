import { ToolExecutionRepository } from "./tool-execution.repository";

describe("ToolExecutionRepository", () => {
  it("upserts leads by organization, contact, and source for retry idempotency", async () => {
    const prisma = {
      contact: {
        findFirst: jest.fn().mockResolvedValue({ id: "contact-1", name: "Ada" }),
        update: jest.fn().mockResolvedValue({ id: "contact-1", name: "Ada" }),
      },
      lead: {
        upsert: jest.fn().mockResolvedValue({ id: "lead-1", status: "NEW" }),
      },
    };
    const repository = new ToolExecutionRepository(prisma as never);

    await repository.upsertContactAndLead({
      organizationId: "org-1",
      conversationId: "conversation-1",
      callId: "call-1",
      agentId: "agent-1",
      name: "Ada",
      email: "ada@example.com",
      source: "AI_AGENT",
    });

    expect(prisma.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_contactId_source: {
            organizationId: "org-1",
            contactId: "contact-1",
            source: "AI_AGENT",
          },
        },
      }),
    );
  });
});
