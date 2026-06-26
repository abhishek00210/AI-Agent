import { NotFoundException } from "@nestjs/common";
import { RetryService } from "./retry.service";

describe("RetryService", () => {
  const messages = { findScoped: jest.fn(), markQueued: jest.fn() };
  const queue = { enqueue: jest.fn() };
  const service = new RetryService(messages as never, queue as never);
  const context = {
    organizationId: "org-1",
    userId: "user-1",
    email: "x@y.com",
    role: "OWNER" as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it("requeues a failed tenant message", async () => {
    messages.findScoped.mockResolvedValue({ id: "message-1", status: "FAILED" });
    await service.retry(context, "message-1");
    expect(messages.markQueued).toHaveBeenCalledWith("org-1", "message-1");
    expect(queue.enqueue).toHaveBeenCalledWith("RetrySMS", {
      organizationId: "org-1",
      messageId: "message-1",
    });
  });

  it("does not reveal cross-tenant messages", async () => {
    messages.findScoped.mockResolvedValue(null);
    await expect(service.retry(context, "foreign-message")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
