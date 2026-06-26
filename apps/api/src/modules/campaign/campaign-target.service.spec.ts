import { CampaignTargetService } from "./campaign-target.service";

describe("CampaignTargetService", () => {
  const prisma = { customerProfile: { findMany: jest.fn() } };
  const service = new CampaignTargetService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("deduplicates explicit customer IDs and always applies organization scope", async () => {
    prisma.customerProfile.findMany.mockResolvedValue([
      { id: "customer-1", contactId: "contact-1", contact: { leads: [{ id: "lead-1" }] } },
    ]);

    const result = await service.resolve({
      organizationId: "org-1",
      customerProfileIds: ["customer-1", "customer-1"],
    });

    expect(prisma.customerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1", id: { in: ["customer-1"] } }),
    }));
    expect(result).toEqual([{ customerProfileId: "customer-1", leadId: "lead-1" }]);
  });
});
