import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import type {
  AutomationExecutionStatus,
  AutomationTriggerType,
  Prisma,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { RealtimeMetricsService } from "../../common/metrics/realtime-metrics.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CustomerTimelineService } from "../customer-timeline/customer-timeline.service";
import { UsageService } from "../usage/usage.service";
import { AutomationActionService } from "./automation-action.service";
import { AutomationRepository } from "./automation-repository";
import {
  automationTriggerId,
  outboundReasonForTrigger,
  type AutomationConditions,
  type AutomationTrigger,
} from "./automation.types";

@Injectable()
export class AutomationEngineService {
  private readonly defaultsReady = new Set<string>();
  private scheduler?: {
    schedule(organizationId: string, executionId: string, scheduledFor: Date): Promise<void>;
  };

  constructor(
    private readonly repository: AutomationRepository,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly actions: AutomationActionService,
    private readonly timeline: CustomerTimelineService,
    private readonly usage: UsageService,
    private readonly analytics: AnalyticsService,
    @Optional() private readonly metrics?: RealtimeMetricsService,
  ) {}

  attachScheduler(scheduler: AutomationEngineService["scheduler"]) {
    this.scheduler = scheduler;
  }

  async trigger(input: AutomationTrigger) {
    const customer = await this.resolveCustomer(input);
    if (!customer) return { scheduled: 0, executions: [] };
    await this.ensureDefaults(input.organizationId);
    this.metrics?.increment(`automation_trigger_${input.triggerType.toLowerCase()}`);
    const workflows = await this.enabledWorkflows(input.organizationId, input.triggerType);
    const executions = [];
    for (const workflow of workflows) {
      const triggerAgentId = jsonString(input.metadata ?? {}, "agentId");
      if (workflow.assignedAgentId && workflow.assignedAgentId !== triggerAgentId) continue;
      const rule = workflow.rules.find((item) => item.enabled && item.template?.enabled !== false);
      if (rule) {
        const scheduledFor = scheduleFor(input, rule);
        const triggerId = automationTriggerId(input);
        const idempotencyKey = [triggerId, workflow.id, customer.id].join(":");
        const reasonDescription = (input.reasonDescription ?? input.followUpReason)
          .trim()
          .slice(0, 2000);
        const result = await this.repository.createExecution({
          organizationId: input.organizationId,
          workflowId: workflow.id,
          ruleId: rule.id,
          customerProfileId: customer.id,
          triggerType: input.triggerType,
          actionType: rule.actionType,
          reasonType: input.reasonType ?? outboundReasonForTrigger(input.triggerType),
          reasonDescription,
          followUpReason: reasonDescription,
          triggerId,
          idempotencyKey,
          scheduledFor,
          metadata: {
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
            triggerMetadata: input.metadata ?? {},
          },
        });
        const execution = result.row;
        if (!result.created) continue;
        executions.push(execution);
        await Promise.all([
          this.scheduler?.schedule(input.organizationId, execution.id, execution.scheduledFor),
          this.timeline.recordEvent({
            organizationId: input.organizationId,
            customerProfileId: customer.id,
            eventType: "FOLLOW_UP_SCHEDULED",
            sourceEntityType: "AutomationExecution",
            sourceEntityId: execution.id,
            idempotencyKey: `automation:scheduled:${execution.id}`,
            description: reasonDescription,
            occurredAt: new Date(),
            metadata: {
              actionType: rule.actionType,
              reasonType: execution.reasonType,
              scheduledFor: scheduledFor.toISOString(),
            },
          }),
          this.timeline.recordEvent({
            organizationId: input.organizationId,
            customerProfileId: customer.id,
            eventType: "WORKFLOW_TRIGGERED",
            sourceEntityType: "AutomationExecution",
            sourceEntityId: execution.id,
            idempotencyKey: `workflow:triggered:${execution.id}`,
            description: reasonDescription,
            occurredAt: new Date(),
            metadata: {
              workflowId: workflow.id,
              templateId: workflow.sourceTemplateId,
              reasonType: execution.reasonType,
            },
          }),
          this.audit(input.organizationId, "automation.execution_scheduled", execution.id, {
            triggerType: input.triggerType,
            actionType: rule.actionType,
            reasonType: execution.reasonType,
          }),
          this.usage.increment({
            organizationId: input.organizationId,
            resourceType: "AUTOMATION_EXECUTIONS",
            idempotencyKey: `automation:execution:${execution.id}`,
          }),
          this.analytics.record({
            organizationId: input.organizationId,
            eventType: "AUTOMATION_TRIGGERED",
            idempotencyKey: `automation:triggered:${execution.id}`,
            metadata: {
              triggerType: input.triggerType,
              actionType: rule.actionType,
              reasonType: execution.reasonType,
            },
          }),
        ]);
      }
    }
    return { scheduled: executions.length, executions };
  }

  async execute(organizationId: string, executionId: string) {
    const claimed = await this.repository.claim(organizationId, executionId);
    if (!claimed) return { skipped: true };
    const execution = await this.repository.execution(organizationId, executionId);
    if (!execution) return { skipped: true };
    try {
      if (!(await this.conditionsPass(execution))) {
        const reason = "Automation conditions are no longer satisfied.";
        await this.repository.cancelRunning(organizationId, execution.id, reason);
        await Promise.all([
          this.timeline.recordEvent({
            organizationId,
            customerProfileId: execution.customerProfileId,
            eventType: "FOLLOW_UP_CANCELLED",
            sourceEntityType: "AutomationExecution",
            sourceEntityId: execution.id,
            idempotencyKey: `automation:cancelled:${execution.id}`,
            description: reason,
          }),
          this.audit(organizationId, "automation.execution_cancelled", execution.id, { reason }),
        ]);
        return { cancelled: true };
      }
      const result = await this.actions.execute(execution);
      await this.repository.complete(
        organizationId,
        execution.id,
        mergeMetadata(execution.metadata, result),
      );
      this.metrics?.increment(`automation_completed_${execution.actionType.toLowerCase()}`);
      await Promise.all([
        this.timeline.recordEvent({
          organizationId,
          customerProfileId: execution.customerProfileId,
          eventType: "WORKFLOW_COMPLETED",
          sourceEntityType: "AutomationExecution",
          sourceEntityId: execution.id,
          idempotencyKey: `workflow:completed:${execution.id}`,
          description: execution.reasonDescription,
        }),
        this.audit(organizationId, "automation.execution_completed", execution.id, {
          actionType: execution.actionType,
          reasonType: execution.reasonType,
        }),
        this.analytics.record({
          organizationId,
          eventType: "AUTOMATION_COMPLETED",
          idempotencyKey: `automation:completed:${execution.id}`,
          metadata: {
            triggerType: execution.triggerType,
            actionType: execution.actionType,
            reasonType: execution.reasonType,
          },
        }),
      ]);
      return { completed: true, result };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Automation action failed.";
      if (execution.attemptCount < 5) {
        const retryAt = new Date(
          Date.now() + Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, execution.attemptCount - 1)),
        );
        await this.repository.retry(organizationId, execution.id, reason, retryAt);
        await this.scheduler?.schedule(organizationId, execution.id, retryAt);
        throw error;
      }
      await this.repository.fail(organizationId, execution.id, reason);
      this.metrics?.increment(`automation_failed_${execution.actionType.toLowerCase()}`);
      await Promise.all([
        this.actions.timelineEvent(execution, "FOLLOW_UP_FAILED"),
        this.audit(organizationId, "automation.execution_failed", execution.id, {
          reason: safeReason(reason),
        }),
        this.analytics.record({
          organizationId,
          eventType: "AUTOMATION_FAILED",
          idempotencyKey: `automation:failed:${execution.id}`,
          metadata: {
            triggerType: execution.triggerType,
            actionType: execution.actionType,
            reasonType: execution.reasonType,
          },
        }),
      ]);
      throw error;
    }
  }

  async cancelForCustomer(
    organizationId: string,
    customerProfileId: string,
    triggerTypes: AutomationTriggerType[],
    reason: string,
  ) {
    const pending = await this.repository.executions(organizationId, {
      customerProfileId,
      limit: 100,
    });
    const targets = pending.filter(
      (item) =>
        triggerTypes.includes(item.triggerType) && ["PENDING", "SCHEDULED"].includes(item.status),
    );
    for (const execution of targets)
      await this.cancelExecution(organizationId, execution.id, reason);
    return { cancelled: targets.length };
  }

  async cancelForContact(
    organizationId: string,
    contactId: string,
    triggerTypes: AutomationTriggerType[],
    reason: string,
  ) {
    const customer = await this.prisma.customerProfile.findFirst({
      where: { organizationId, contactId },
      select: { id: true },
    });
    if (!customer) return { cancelled: 0 };
    return this.cancelForCustomer(organizationId, customer.id, triggerTypes, reason);
  }

  async cancelExecution(organizationId: string, executionId: string, reason: string) {
    const execution = await this.repository.execution(organizationId, executionId);
    if (!execution) throw new NotFoundException("Automation execution not found.");
    const result = await this.repository.cancel(organizationId, { id: executionId }, reason);
    if (result.count) {
      await Promise.all([
        this.timeline.recordEvent({
          organizationId,
          customerProfileId: execution.customerProfileId,
          eventType: "FOLLOW_UP_CANCELLED",
          sourceEntityType: "AutomationExecution",
          sourceEntityId: execution.id,
          idempotencyKey: `automation:cancelled:${execution.id}`,
          description: reason,
        }),
        this.timeline.recordEvent({
          organizationId,
          customerProfileId: execution.customerProfileId,
          eventType: "WORKFLOW_CANCELLED",
          sourceEntityType: "AutomationExecution",
          sourceEntityId: execution.id,
          idempotencyKey: `workflow:cancelled:${execution.id}`,
          description: reason,
        }),
        this.audit(organizationId, "automation.execution_cancelled", execution.id, {
          reason: safeReason(reason),
        }),
      ]);
    }
    return { cancelled: result.count === 1 };
  }

  async dashboard(organizationId: string) {
    await this.ensureDefaults(organizationId);
    const [workflows, recent, grouped, workflowStatuses] = await Promise.all([
      this.repository.workflows(organizationId),
      this.repository.executions(organizationId, { limit: 50 }),
      this.prisma.automationExecution.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.automationExecution.groupBy({
        by: ["workflowId", "status"],
        where: { organizationId },
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    const completed = counts.COMPLETED ?? 0;
    const failed = counts.FAILED ?? 0;
    const templatePerformance = workflows
      .filter((workflow) => workflow.sourceTemplateId)
      .map((workflow) => {
        const rows = workflowStatuses.filter((row) => row.workflowId === workflow.id);
        const successful = rows.find((row) => row.status === "COMPLETED")?._count._all ?? 0;
        const unsuccessful = rows.find((row) => row.status === "FAILED")?._count._all ?? 0;
        return {
          templateId: workflow.sourceTemplateId!,
          workflowId: workflow.id,
          workflowName: workflow.name,
          executions: rows.reduce((sum, row) => sum + row._count._all, 0),
          successRate:
            successful + unsuccessful ? (successful / (successful + unsuccessful)) * 100 : 0,
        };
      });
    return {
      workflows,
      executions: recent,
      metrics: {
        pending: (counts.PENDING ?? 0) + (counts.SCHEDULED ?? 0),
        completed,
        failed,
        cancelled: counts.CANCELLED ?? 0,
        successRate: completed + failed ? (completed / (completed + failed)) * 100 : 0,
      },
      templatePerformance,
      mostEffectiveTemplate:
        templatePerformance.slice().sort((a, b) => b.successRate - a.successRate)[0] ?? null,
    };
  }

  listExecutions(
    organizationId: string,
    input: {
      status?: AutomationExecutionStatus;
      customerProfileId?: string;
      workflowId?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    return this.repository.executions(organizationId, {
      ...input,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 100),
    });
  }

  templates(organizationId: string) {
    return this.repository.templates(organizationId);
  }

  async updateTemplate(
    organizationId: string,
    id: string,
    input: { name?: string; subject?: string; body?: string; enabled?: boolean },
  ) {
    const template = await this.prisma.automationTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) throw new NotFoundException("Automation template not found.");
    const row = await this.prisma.automationTemplate.update({ where: { id }, data: input });
    await Promise.all([
      this.invalidate(organizationId),
      this.audit(organizationId, "automation.template_updated", id),
    ]);
    return row;
  }

  async adminOverview() {
    return this.prisma.automationWorkflow.findMany({
      include: {
        organization: { select: { id: true, name: true } },
        rules: true,
        _count: { select: { executions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
  }

  async adminDisableWorkflow(id: string) {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException("Automation workflow not found.");
    return this.updateWorkflow(workflow.organizationId, id, { enabled: false });
  }

  async updateWorkflow(
    organizationId: string,
    id: string,
    input: { name?: string; description?: string; enabled?: boolean },
  ) {
    if (!(await this.repository.workflow(organizationId, id)))
      throw new NotFoundException("Automation workflow not found.");
    const row = await this.prisma.automationWorkflow.update({ where: { id }, data: input });
    await Promise.all([
      this.invalidate(organizationId),
      this.audit(
        organizationId,
        input.enabled === false ? "automation.workflow_disabled" : "automation.workflow_updated",
        id,
      ),
    ]);
    return row;
  }

  async updateRule(
    organizationId: string,
    id: string,
    input: {
      delayMinutes?: number;
      templateId?: string | null;
      enabled?: boolean;
      conditions?: Prisma.InputJsonValue;
    },
  ) {
    if (!(await this.repository.rule(organizationId, id)))
      throw new NotFoundException("Automation rule not found.");
    if (
      input.templateId &&
      !(await this.prisma.automationTemplate.findFirst({
        where: { id: input.templateId, organizationId },
      }))
    )
      throw new NotFoundException("Automation template not found.");
    const row = await this.prisma.automationRule.update({ where: { id }, data: input });
    await Promise.all([
      this.invalidate(organizationId),
      this.audit(organizationId, "automation.rule_updated", id),
    ]);
    return row;
  }

  async ensureDefaults(organizationId: string) {
    if (this.defaultsReady.has(organizationId)) return;
    this.defaultsReady.add(organizationId);
  }

  private async enabledWorkflows(organizationId: string, triggerType: AutomationTriggerType) {
    const key = `automation:workflows:v1:${organizationId}:${triggerType}`;
    if (this.redis.isAvailable) {
      const cached = await this.redis.cache.get(key).catch(() => null);
      if (cached)
        return JSON.parse(cached) as Awaited<ReturnType<AutomationRepository["workflows"]>>;
    }
    const rows = (await this.repository.workflows(organizationId, triggerType)).filter(
      (workflow) => workflow.enabled,
    );
    if (this.redis.isAvailable)
      await this.redis.cache.set(key, JSON.stringify(rows), "EX", 300).catch(() => undefined);
    return rows;
  }

  private async invalidate(organizationId: string) {
    if (!this.redis.isAvailable) return;
    await Promise.all(
      [
        "NEW_LEAD",
        "MISSED_APPOINTMENT",
        "APPOINTMENT_COMPLETED",
        "NO_RESPONSE",
        "UPCOMING_APPOINTMENT",
        "QUOTE_SENT",
      ].map((type) =>
        this.redis.cache.del(`automation:workflows:v1:${organizationId}:${type}`).catch(() => 0),
      ),
    );
  }

  private async resolveCustomer(input: AutomationTrigger) {
    if (input.customerProfileId)
      return this.prisma.customerProfile.findFirst({
        where: { id: input.customerProfileId, organizationId: input.organizationId },
      });
    if (input.contactId)
      return this.prisma.customerProfile.findFirst({
        where: { contactId: input.contactId, organizationId: input.organizationId },
      });
    return null;
  }

  private async conditionsPass(
    execution: NonNullable<Awaited<ReturnType<AutomationRepository["execution"]>>>,
  ) {
    if (
      !execution.workflow.enabled ||
      !execution.rule.enabled ||
      execution.rule.template?.enabled === false
    )
      return false;
    const conditions = (execution.rule.conditions ?? {}) as AutomationConditions;
    if (
      conditions.customerStatuses?.length &&
      !conditions.customerStatuses.includes(execution.customerProfile.leadStatus)
    )
      return false;
    if (
      conditions.lastContactBeforeMinutes &&
      execution.customerProfile.lastContactAt &&
      execution.customerProfile.lastContactAt >
        new Date(Date.now() - conditions.lastContactBeforeMinutes * 60_000)
    )
      return false;
    if (conditions.maxPreviousFollowUps !== undefined) {
      const previous = await this.prisma.automationExecution.count({
        where: {
          organizationId: execution.organizationId,
          customerProfileId: execution.customerProfileId,
          status: "COMPLETED",
          id: { not: execution.id },
        },
      });
      if (previous >= conditions.maxPreviousFollowUps) return false;
    }
    const sourceId = jsonString(execution.metadata, "sourceEntityId");
    if (conditions.noAppointmentBooked) {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          organizationId: execution.organizationId,
          contactId: execution.customerProfile.contactId,
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { gte: new Date() },
        },
        select: { id: true },
      });
      if (appointment) return false;
    }
    if (conditions.leadStatuses?.length) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          organizationId: execution.organizationId,
          contactId: execution.customerProfile.contactId,
          deletedAt: null,
        },
        select: { status: true },
      });
      if (!lead || !conditions.leadStatuses.includes(lead.status)) return false;
    }
    if (conditions.appointmentStatuses?.length && sourceId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: sourceId, organizationId: execution.organizationId },
        select: { status: true },
      });
      if (!appointment || !conditions.appointmentStatuses.includes(appointment.status))
        return false;
    }
    return true;
  }

  private audit(
    organizationId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditEvent.create({
      data: { organizationId, action, entityType: "AutomationExecution", entityId, metadata },
    });
  }
}

function jsonString(value: unknown, key: string) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)[key] === "string"
    ? ((value as Record<string, unknown>)[key] as string)
    : null;
}
function scheduleFor(
  input: AutomationTrigger,
  rule: { delayMinutes: number; conditions: Prisma.JsonValue },
) {
  const conditions =
    rule.conditions && typeof rule.conditions === "object" && !Array.isArray(rule.conditions)
      ? (rule.conditions as Record<string, unknown>)
      : {};
  const timing = conditions.timing === "BEFORE_EVENT" ? "BEFORE_EVENT" : "AFTER_TRIGGER";
  const eventAt = jsonString(input.metadata ?? {}, "eventAt");
  if (timing === "BEFORE_EVENT" && eventAt) {
    const scheduled = new Date(new Date(eventAt).getTime() - rule.delayMinutes * 60_000);
    return scheduled > new Date() ? scheduled : new Date();
  }
  return new Date((input.occurredAt ?? new Date()).getTime() + rule.delayMinutes * 60_000);
}
function mergeMetadata(
  existing: Prisma.JsonValue,
  result: Prisma.InputJsonValue,
): Prisma.InputJsonValue {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  return { ...base, result } as Prisma.InputJsonValue;
}
function safeReason(reason: string) {
  return reason.replace(/[+]?\d[\d\s().-]{7,}/g, "[REDACTED_PHONE]").slice(0, 300);
}
