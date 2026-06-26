import { NotFoundException } from "@nestjs/common";
import { CustomerResolverService } from "./customer-resolver.service";

describe("CustomerResolverService", () => {
  const prisma = {
    customerProfile: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    contact: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const redis = { isAvailable: false, cache: {} };
  const usage = { increment: jest.fn() };
  const service = new CustomerResolverService(prisma as never, redis as never, usage as never);
  beforeEach(() => jest.clearAllMocks());

  it("creates one profile referencing the canonical contact", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue(null);
    prisma.contact.create.mockResolvedValue({ id: "contact-1", name: "Jane", phone: "+14165550100", email: null, company: null, notes: null });
    prisma.customerProfile.create.mockResolvedValue({ id: "customer-1", contactId: "contact-1", phone: "+14165550100" });
    const result = await service.resolveCustomer({ organizationId: "org-1", name: "Jane", phone: "+1 (416) 555-0100", interaction: "CALL" });
    expect(result.contactId).toBe("contact-1");
    expect(prisma.customerProfile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-1", contactId: "contact-1", totalCalls: 1 }) }));
  });

  it("matches normalized phone and updates instead of duplicating", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1", organizationId: "org-1", contactId: "contact-1", name: "Jane", phone: "+14165550100", email: null, company: null, notes: null, leadStatus: "NEW" });
    prisma.customerProfile.update.mockResolvedValue({ id: "customer-1", contactId: "contact-1", phone: "+14165550100" });
    prisma.contact.update.mockResolvedValue({});
    await service.resolveCustomer({ organizationId: "org-1", phone: "+14165550100", interaction: "CALL" });
    expect(prisma.customerProfile.create).not.toHaveBeenCalled();
    expect(prisma.customerProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalCalls: { increment: 1 } }) }));
  });

  it("scopes profile details to the tenant", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue(null);
    await expect(service.get("org-1", "customer-2")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.customerProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "customer-2", organizationId: "org-1" } }));
  });
});
