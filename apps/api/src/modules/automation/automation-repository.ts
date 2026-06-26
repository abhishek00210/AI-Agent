import { Injectable } from "@nestjs/common";
import type {
  AutomationActionType,
  AutomationExecutionStatus,
  AutomationTriggerType,
  OutboundCallReason,
  Prisma,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { Prisma as PrismaRuntime } from "../../../generated/prisma";

@Injectable()
export class AutomationRepository {
  constructor(readonly prisma: PrismaService) {}

  workflows(organizationId: string, triggerType?: AutomationTriggerType) {
    return this.prisma.automationWorkflow.findMany({
      where: { organizationId, ...(triggerType ? { triggerType } : {}) },
      include: { rules: { include: { template: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
  }

  workflow(organizationId: string, id: string) {
    return this.prisma.automationWorkflow.findFirst({
      where: { id, organizationId },
      include: { rules: { include: { template: true } } },
    });
  }

  rule(organizationId: string, id: string) {
    return this.prisma.automationRule.findFirst({
      where: { id, workflow: { organizationId } },
      include: { workflow: true, template: true },
    });
  }

  executions(
    organizationId: string,
    input: {
      status?: AutomationExecutionStatus;
      customerProfileId?: string;
      workflowId?: string;
      cursor?: string;
      limit: number;
    },
  ) {
    return this.prisma.automationExecution.findMany({
      where: {
        organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.customerProfileId ? { customerProfileId: input.customerProfileId } : {}),
        ...(input.workflowId ? { workflowId: input.workflowId } : {}),
      },
      include: {
        workflow: { select: { id: true, name: true, triggerType: true } },
        rule: { select: { id: true, actionType: true, delayMinutes: true } },
        customerProfile: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: [{ scheduledFor: "desc" }, { id: "desc" }],
      take: input.limit,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
  }

  execution(organizationId: string, id: string) {
    return this.prisma.automationExecution.findFirst({
      where: { id, organizationId },
      include: { workflow: true, rule: { include: { template: true } }, customerProfile: true },
    });
  }

  createExecution(input: {
    organizationId: string;
    workflowId: string;
    ruleId: string;
    customerProfileId: string;
    triggerType: AutomationTriggerType;
    actionType: AutomationActionType;
    reasonType: OutboundCallReason;
    reasonDescription: string;
    followUpReason: string;
    triggerId: string;
    idempotencyKey: string;
    scheduledFor: Date;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.automationExecution
      .create({ data: { ...input, status: "SCHEDULED" } })
      .then((row) => ({ row, created: true as const }))
      .catch(async (error: unknown) => {
        if (
          !(error instanceof PrismaRuntime.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        )
          throw error;
        const row = await this.prisma.automationExecution.findFirstOrThrow({
          where: {
            organizationId: input.organizationId,
            triggerId: input.triggerId,
            workflowId: input.workflowId,
            customerProfileId: input.customerProfileId,
          },
        });
        return { row, created: false as const };
      });
  }

  async claim(organizationId: string, id: string) {
    const claimed = await this.prisma.automationExecution.updateMany({
      where: {
        id,
        organizationId,
        status: { in: ["PENDING", "SCHEDULED"] },
        scheduledFor: { lte: new Date() },
      },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        failureReason: null,
        attemptCount: { increment: 1 },
      },
    });
    return claimed.count === 1;
  }

  complete(organizationId: string, id: string, metadata: Prisma.InputJsonValue) {
    return this.prisma.automationExecution.updateMany({
      where: { id, organizationId, status: "RUNNING" },
      data: { status: "COMPLETED", completedAt: new Date(), metadata },
    });
  }

  fail(organizationId: string, id: string, reason: string) {
    return this.prisma.automationExecution.updateMany({
      where: { id, organizationId, status: "RUNNING" },
      data: { status: "FAILED", failedAt: new Date(), failureReason: reason.slice(0, 1000) },
    });
  }

  retry(organizationId: string, id: string, reason: string, scheduledFor: Date) {
    return this.prisma.automationExecution.updateMany({
      where: { id, organizationId, status: "RUNNING" },
      data: { status: "SCHEDULED", scheduledFor, failureReason: reason.slice(0, 1000) },
    });
  }

  cancel(organizationId: string, where: Prisma.AutomationExecutionWhereInput, reason: string) {
    return this.prisma.automationExecution.updateMany({
      where: { organizationId, status: { in: ["PENDING", "SCHEDULED"] }, ...where },
      data: { status: "CANCELLED", cancelledAt: new Date(), failureReason: reason.slice(0, 1000) },
    });
  }

  cancelRunning(organizationId: string, id: string, reason: string) {
    return this.prisma.automationExecution.updateMany({
      where: { id, organizationId, status: "RUNNING" },
      data: { status: "CANCELLED", cancelledAt: new Date(), failureReason: reason.slice(0, 1000) },
    });
  }

  due(limit = 100) {
    return this.prisma.automationExecution.findMany({
      where: { status: { in: ["PENDING", "SCHEDULED"] }, scheduledFor: { lte: new Date() } },
      select: { id: true, organizationId: true },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });
  }

  templates(organizationId: string) {
    return this.prisma.automationTemplate.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }
}
