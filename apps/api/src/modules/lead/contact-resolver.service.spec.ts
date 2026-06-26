import { ContactResolver } from "./contact-resolver.service";

describe("ContactResolver", () => {
  it("normalizes phone and email before matching existing contacts", async () => {
    const repository = {
      findContactByPhoneOrEmail: jest.fn().mockResolvedValue({ id: "contact-1" }),
      updateContact: jest.fn().mockResolvedValue({ id: "contact-1" }),
      createContact: jest.fn(),
    };
    const resolver = new ContactResolver(repository as never);

    await resolver.resolve({
      organizationId: "org-1",
      name: "Jane Customer",
      phone: "+1 (416) 555-0100",
      email: "JANE@EXAMPLE.COM",
    });

    expect(repository.findContactByPhoneOrEmail).toHaveBeenCalledWith(
      "org-1",
      "+14165550100",
      "jane@example.com",
    );
    expect(repository.updateContact).toHaveBeenCalledWith(
      "contact-1",
      expect.objectContaining({
        phone: "+14165550100",
        email: "jane@example.com",
      }),
    );
  });

  it("recovers from concurrent contact creation races by re-reading the unique contact", async () => {
    const repository = {
      findContactByPhoneOrEmail: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "contact-1" }),
      createContact: jest.fn().mockRejectedValue({ code: "P2002" }),
      updateContact: jest.fn().mockResolvedValue({ id: "contact-1" }),
    };
    const resolver = new ContactResolver(repository as never);

    const result = await resolver.resolve({
      organizationId: "org-1",
      name: "Jane Customer",
      email: "jane@example.com",
    });

    expect(result.id).toBe("contact-1");
    expect(repository.createContact).toHaveBeenCalledTimes(1);
    expect(repository.updateContact).toHaveBeenCalledTimes(1);
  });
});
