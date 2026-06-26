import { CommunicationThreadService } from "./communication-thread.service";

describe("CommunicationThreadService", () => {
  it("increments unread count only for inbound messages", async () => {
    const repository = {
      upsertThread: jest.fn().mockResolvedValue({ id: "thread-1" }),
      markRead: jest.fn(),
    };
    const service = new CommunicationThreadService(repository as never);

    await service.recordMessage({
      organizationId: "org-1",
      contactId: "contact-1",
      channel: "SMS",
      direction: "INBOUND",
    });
    await service.recordMessage({
      organizationId: "org-1",
      contactId: "contact-1",
      channel: "SMS",
      direction: "OUTBOUND",
    });

    expect(repository.upsertThread).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ incrementUnread: true }),
    );
    expect(repository.upsertThread).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ incrementUnread: false }),
    );
  });
});
