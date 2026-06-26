import { NotFoundException } from "@nestjs/common";
import { WorkflowTemplateService } from "./workflow-template.service";

describe("WorkflowTemplateService", () => {
  const prisma = {
    $transaction: jest.fn(),
    workflowTemplate: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
  };
  const service = new WorkflowTemplateService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(service, "ensureSystemTemplates").mockResolvedValue(undefined);
  });

  it("lists only system and tenant-owned templates", async () => {
    prisma.workflowTemplate.findMany.mockResolvedValue([]);
    await service.list("org-a", "LEAD");
    expect(prisma.workflowTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "LEAD",
          OR: [{ organizationId: null, systemTemplate: true }, { organizationId: "org-a" }],
        }),
      }),
    );
  });

  it("does not expose another tenant's template", async () => {
    prisma.workflowTemplate.findFirst.mockResolvedValue(null);
    await expect(service.get("org-a", "template-b")).rejects.toBeInstanceOf(NotFoundException);
  });
});
