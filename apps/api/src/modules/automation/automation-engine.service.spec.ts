import { NotFoundException } from "@nestjs/common";
import { AutomationEngineService } from "./automation-engine.service";

describe("AutomationEngineService", () => {
  const repository = {
    createExecution: jest.fn(),
    claim: jest.fn(),
    execution: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    retry: jest.fn(),
    cancel: jest.fn(),
    cancelRunning: jest.fn(),
    executions: jest.fn(),
    workflows: jest.fn(),
    templates: jest.fn(),
    workflow: jest.fn(),
    rule: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(),
    customerProfile: { findFirst: jest.fn() },
    automationExecution: { groupBy: jest.fn(), count: jest.fn() },
    appointment: { findFirst: jest.fn() },
    lead: { findFirst: jest.fn() },
    auditEvent: { create: jest.fn() },
  };
  const redis = { isAvailable: false, cache: { get: jest.fn(), set: jest.fn(), del: jest.fn() } };
  const actions = { execute: jest.fn(), timelineEvent: jest.fn() };
  const timeline = { recordEvent: jest.fn() };
  const usage = { increment: jest.fn() };
  const analytics = { record: jest.fn() };
  let service: AutomationEngineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationEngineService(
      repository as never,
      prisma as never,
      redis as never,
      actions as never,
      timeline as never,
      usage as never,
      analytics as never,
    );
    jest.spyOn(service, "ensureDefaults").mockResolvedValue(undefined);
  });

  it("schedules an idempotent execution with a durable follow-up reason", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    jest.spyOn(service as never, "enabledWorkflows").mockResolvedValue([
      {
        id: "workflow-1",
        rules: [
          {
            id: "rule-1",
            enabled: true,
            delayMinutes: 15,
            actionType: "SMS",
            template: { enabled: true },
          },
        ],
      },
    ] as never);
    repository.createExecution.mockImplementation(async (input) => ({
      row: { id: "execution-1", ...input },
      created: true,
    }));
    const scheduler = { schedule: jest.fn() };
    service.attachScheduler(scheduler);

    const result = await service.trigger({
      organizationId: "org-a",
      triggerType: "MISSED_APPOINTMENT",
      contactId: "contact-1",
      sourceEntityType: "Appointment",
      sourceEntityId: "appointment-1",
      followUpReason: "Customer missed the inspection scheduled June 28.",
    });

    expect(result.scheduled).toBe(1);
    expect(repository.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-a",
        customerProfileId: "customer-1",
        reasonType: "MISSED_APPOINTMENT",
        reasonDescription: "Customer missed the inspection scheduled June 28.",
        followUpReason: "Customer missed the inspection scheduled June 28.",
        triggerId: "MISSED_APPOINTMENT:Appointment:appointment-1",
        idempotencyKey: "MISSED_APPOINTMENT:Appointment:appointment-1:workflow-1:customer-1",
      }),
    );
    expect(scheduler.schedule).toHaveBeenCalledWith("org-a", "execution-1", expect.any(Date));
    expect(timeline.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "FOLLOW_UP_SCHEDULED",
        customerProfileId: "customer-1",
      }),
    );
  });

  it("does not schedule duplicate side effects when the same trigger is retried", async () => {
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    jest.spyOn(service as never, "enabledWorkflows").mockResolvedValue([
      {
        id: "workflow-1",
        rules: [
          {
            id: "rule-1",
            enabled: true,
            delayMinutes: 15,
            actionType: "SMS",
            template: { enabled: true },
          },
        ],
      },
    ] as never);
    const row = {
      id: "execution-1",
      scheduledFor: new Date(Date.now() + 15 * 60_000),
    };
    repository.createExecution
      .mockResolvedValueOnce({ row, created: true })
      .mockResolvedValueOnce({ row, created: false });
    const scheduler = { schedule: jest.fn() };
    service.attachScheduler(scheduler);
    const trigger = {
      organizationId: "org-a",
      triggerType: "NEW_LEAD" as const,
      contactId: "contact-1",
      sourceEntityType: "Lead" as const,
      sourceEntityId: "lead-1",
      reasonType: "LEAD_FOLLOW_UP" as const,
      reasonDescription: "New lead requested a quote.",
      followUpReason: "New lead requested a quote.",
    };

    const first = await service.trigger(trigger);
    const retry = await service.trigger(trigger);

    expect(first.scheduled).toBe(1);
    expect(retry.scheduled).toBe(0);
    expect(repository.createExecution).toHaveBeenCalledTimes(2);
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(timeline.recordEvent).toHaveBeenCalledTimes(2);
    expect(timeline.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "FOLLOW_UP_SCHEDULED" }),
    );
    expect(timeline.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "WORKFLOW_TRIGGERED" }),
    );
    expect(usage.increment).toHaveBeenCalledTimes(1);
    expect(analytics.record).toHaveBeenCalledTimes(1);
  });

  it("schedules appointment reminders before the event time", async () => {
    const eventAt = new Date(Date.now() + 48 * 60 * 60_000);
    prisma.customerProfile.findFirst.mockResolvedValue({ id: "customer-1" });
    jest.spyOn(service as never, "enabledWorkflows").mockResolvedValue([
      {
        id: "workflow-1",
        assignedAgentId: null,
        rules: [
          {
            id: "rule-1",
            enabled: true,
            delayMinutes: 1440,
            actionType: "SMS",
            conditions: { timing: "BEFORE_EVENT" },
            template: { enabled: true },
          },
        ],
      },
    ] as never);
    repository.createExecution.mockImplementation(async (input) => ({
      row: { id: "execution-1", ...input },
      created: true,
    }));
    await service.trigger({
      organizationId: "org-a",
      triggerType: "UPCOMING_APPOINTMENT",
      contactId: "contact-1",
      sourceEntityType: "Appointment",
      sourceEntityId: "appointment-1",
      reasonType: "APPOINTMENT_REMINDER",
      followUpReason: "Appointment reminder.",
      reasonDescription: "Appointment reminder.",
      metadata: { eventAt: eventAt.toISOString(), agentId: "agent-1" },
    });
    const scheduledFor = repository.createExecution.mock.calls[0][0].scheduledFor as Date;
    expect(Math.abs(scheduledFor.getTime() - (eventAt.getTime() - 24 * 60 * 60_000))).toBeLessThan(
      50,
    );
  });

  it("executes through the action abstraction and records completion", async () => {
    repository.claim.mockResolvedValue(true);
    const execution = loadedExecution();
    repository.execution.mockResolvedValue(execution);
    jest.spyOn(service as never, "conditionsPass").mockResolvedValue(true as never);
    actions.execute.mockResolvedValue({ communicationMessageId: "message-1" });
    const result = await service.execute("org-a", "execution-1");
    expect(result).toEqual(expect.objectContaining({ completed: true }));
    expect(repository.complete).toHaveBeenCalledWith(
      "org-a",
      "execution-1",
      expect.objectContaining({ result: { communicationMessageId: "message-1" } }),
    );
    expect(actions.timelineEvent).not.toHaveBeenCalledWith(execution, "FOLLOW_UP_SENT");
  });

  it("does not execute a claimed job from another tenant", async () => {
    repository.claim.mockResolvedValue(false);
    await expect(service.execute("org-b", "execution-1")).resolves.toEqual({ skipped: true });
    expect(actions.execute).not.toHaveBeenCalled();
  });

  it("executes a retried worker job at most once", async () => {
    const execution = loadedExecution();
    repository.claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    repository.execution.mockResolvedValue(execution);
    jest.spyOn(service as never, "conditionsPass").mockResolvedValue(true as never);
    actions.execute.mockResolvedValue({ communicationMessageId: "message-1" });

    await service.execute("org-a", "execution-1");
    await service.execute("org-a", "execution-1");

    expect(actions.execute).toHaveBeenCalledTimes(1);
    expect(repository.complete).toHaveBeenCalledTimes(1);
  });

  it("cancels a claimed execution when business conditions changed", async () => {
    repository.claim.mockResolvedValue(true);
    repository.execution.mockResolvedValue(loadedExecution());
    jest.spyOn(service as never, "conditionsPass").mockResolvedValue(false as never);
    await expect(service.execute("org-a", "execution-1")).resolves.toEqual({ cancelled: true });
    expect(repository.cancelRunning).toHaveBeenCalledWith(
      "org-a",
      "execution-1",
      "Automation conditions are no longer satisfied.",
    );
    expect(actions.execute).not.toHaveBeenCalled();
  });

  it("reschedules transient failures with bounded exponential retry", async () => {
    repository.claim.mockResolvedValue(true);
    repository.execution.mockResolvedValue({ ...loadedExecution(), attemptCount: 1 });
    jest.spyOn(service as never, "conditionsPass").mockResolvedValue(true as never);
    actions.execute.mockRejectedValue(new Error("temporary provider outage"));
    const scheduler = { schedule: jest.fn() };
    service.attachScheduler(scheduler);
    await expect(service.execute("org-a", "execution-1")).rejects.toThrow(
      "temporary provider outage",
    );
    expect(repository.retry).toHaveBeenCalledWith(
      "org-a",
      "execution-1",
      "temporary provider outage",
      expect.any(Date),
    );
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("rejects cancellation when the tenant-scoped execution is absent", async () => {
    repository.execution.mockResolvedValue(null);
    await expect(service.cancelExecution("org-b", "execution-1", "test")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("blocks queued work when its workflow is disabled before execution", async () => {
    const execution = loadedExecution();
    execution.workflow.enabled = false;
    await expect(
      (service as unknown as { conditionsPass(value: unknown): Promise<boolean> }).conditionsPass(
        execution,
      ),
    ).resolves.toBe(false);
  });
});

function loadedExecution() {
  return {
    id: "execution-1",
    organizationId: "org-a",
    workflowId: "workflow-1",
    ruleId: "rule-1",
    customerProfileId: "customer-1",
    triggerType: "NEW_LEAD",
    actionType: "SMS",
    status: "RUNNING",
    reasonType: "LEAD_FOLLOW_UP",
    reasonDescription: "New lead requested a quote.",
    followUpReason: "New lead requested a quote.",
    idempotencyKey: "key",
    scheduledFor: new Date(),
    startedAt: new Date(),
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    failureReason: null,
    attemptCount: 5,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    workflow: { id: "workflow-1", enabled: true },
    rule: {
      id: "rule-1",
      enabled: true,
      conditions: {},
      template: { body: "Hi {{firstName}}", subject: null, enabled: true },
    },
    customerProfile: {
      id: "customer-1",
      contactId: "contact-1",
      name: "John Smith",
      phone: "+14165550100",
      email: "john@example.com",
      leadStatus: "NEW",
      lastContactAt: null,
    },
  };
}
