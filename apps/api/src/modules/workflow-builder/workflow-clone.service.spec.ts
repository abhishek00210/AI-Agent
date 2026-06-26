import { NotFoundException } from "@nestjs/common";
import { WorkflowCloneService } from "./workflow-clone.service";

describe("WorkflowCloneService", () => {
  const tx = {
    $executeRaw: jest.fn(),
    automationWorkflow: { findFirst: jest.fn(), create: jest.fn() },
    automationTemplate: { create: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    agent: { findFirst: jest.fn() },
  };
  const templates = { get: jest.fn() };
  const analytics = { record: jest.fn() };
  const usage = { increment: jest.fn() };
  const service = new WorkflowCloneService(
    prisma as never,
    templates as never,
    analytics as never,
    usage as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    templates.get.mockResolvedValue(template());
    tx.automationWorkflow.findFirst.mockResolvedValue(null);
    tx.automationTemplate.create.mockResolvedValue({ id: "message-template-1" });
    tx.automationWorkflow.create.mockResolvedValue({
      id: "workflow-1",
      enabled: true,
      rules: [],
    });
  });

  it("activates a system template into the existing automation engine", async () => {
    const result = await service.activate("org-a", "template-1", {
      delayMinutes: 30,
      messageTemplate: "Hi {{firstName}}, checking in.",
    });
    expect(result.created).toBe(true);
    expect(tx.automationWorkflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-a",
          sourceTemplateId: "template-1",
          sourceTemplateVersion: 1,
          enabled: true,
          rules: {
            create: expect.objectContaining({
              delayMinutes: 30,
              actionType: "SMS",
              templateId: "message-template-1",
            }),
          },
        }),
      }),
    );
    expect(usage.increment).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "WORKFLOW_TEMPLATE_ACTIVATIONS" }),
    );
  });

  it("returns the existing workflow without duplicate activation side effects", async () => {
    tx.automationWorkflow.findFirst.mockResolvedValue({
      id: "workflow-1",
      enabled: true,
      rules: [],
    });
    const result = await service.activate("org-a", "template-1");
    expect(result.created).toBe(false);
    expect(tx.automationTemplate.create).not.toHaveBeenCalled();
    expect(usage.increment).not.toHaveBeenCalled();
    expect(analytics.record).not.toHaveBeenCalled();
  });

  it("rejects an assigned agent from another tenant", async () => {
    prisma.agent.findFirst.mockResolvedValue(null);
    await expect(
      service.activate("org-a", "template-1", { assignedAgentId: "agent-other" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function template() {
  return {
    id: "template-1",
    name: "Lead Follow-Up",
    description: "Follow up",
    category: "LEAD",
    estimatedConversionImpact: 4,
    versions: [{ version: 1 }],
    configuration: {
      triggerType: "NEW_LEAD",
      delayMinutes: 1440,
      timing: "AFTER_TRIGGER",
      actionType: "SMS",
      messageTemplate: "Hi {{firstName}}",
      conditions: { noAppointmentBooked: true },
      assignedAgentId: null,
    },
  };
}
