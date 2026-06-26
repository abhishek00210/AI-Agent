import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { UsageService } from "../usage/usage.service";
import { WorkflowTemplateService } from "./workflow-template.service";
import type { WorkflowCustomization, WorkflowConfiguration } from "./workflow-builder.types";

@Injectable()
export class WorkflowCloneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: WorkflowTemplateService,
    private readonly analytics: AnalyticsService,
    private readonly usage: UsageService,
  ) {}

  async activate(
    organizationId: string,
    templateId: string,
    customization: WorkflowCustomization = {},
  ) {
    const source = await this.templates.get(organizationId, templateId);
    const configuration = mergeConfiguration(source.configuration, customization);
    await this.validateConfiguration(organizationId, configuration);
    const version = source.versions[0]?.version ?? 1;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-activate:${organizationId}:${templateId}`}))`;
      const existing = await tx.automationWorkflow.findFirst({
        where: { organizationId, sourceTemplateId: templateId },
        include: { rules: { include: { template: true } } },
      });
      if (existing) return { workflow: existing, created: false };
      const messageTemplate = await tx.automationTemplate.create({
        data: {
          organizationId,
          name: uniqueMessageTemplateName(source.name, templateId),
          actionType: configuration.actionType,
          subject: configuration.emailSubject,
          body: configuration.messageTemplate,
        },
      });
      const workflow = await tx.automationWorkflow.create({
        data: {
          organizationId,
          name: customization.name?.trim() || source.name,
          description: customization.description?.trim() || source.description,
          triggerType: configuration.triggerType,
          enabled: customization.enabled ?? true,
          assignedAgentId: configuration.assignedAgentId,
          sourceTemplateId: templateId,
          sourceTemplateVersion: version,
          rules: {
            create: {
              delayMinutes: configuration.delayMinutes,
              actionType: configuration.actionType,
              templateId: messageTemplate.id,
              conditions: {
                ...configuration.conditions,
                timing: configuration.timing,
              } as Prisma.InputJsonValue,
            },
          },
        },
        include: { rules: { include: { template: true } } },
      });
      await tx.auditEvent.create({
        data: {
          organizationId,
          action: "workflow.template_activated",
          entityType: "AutomationWorkflow",
          entityId: workflow.id,
          metadata: { templateId, templateVersion: version, category: source.category },
        },
      });
      return { workflow, created: true };
    });
    if (result.created) {
      await Promise.all([
        this.usage.increment({
          organizationId,
          resourceType: "WORKFLOW_TEMPLATE_ACTIVATIONS",
          idempotencyKey: `workflow:template-activation:${templateId}`,
        }),
        this.analytics.record({
          organizationId,
          eventType: "WORKFLOW_TEMPLATE_ACTIVATED",
          idempotencyKey: `workflow:template-activation:${templateId}`,
          metadata: {
            templateId,
            category: source.category,
            estimatedConversionImpact: source.estimatedConversionImpact,
          },
        }),
      ]);
    }
    return result;
  }

  async createCustom(
    organizationId: string,
    input: {
      name: string;
      description?: string;
      configuration: WorkflowConfiguration;
      enabled?: boolean;
    },
  ) {
    await this.validateConfiguration(organizationId, input.configuration);
    return this.prisma.$transaction(async (tx) => {
      const messageTemplate = await tx.automationTemplate.create({
        data: {
          organizationId,
          name: `${input.name.trim()} message`,
          actionType: input.configuration.actionType,
          subject: input.configuration.emailSubject,
          body: input.configuration.messageTemplate,
        },
      });
      const workflow = await tx.automationWorkflow.create({
        data: {
          organizationId,
          name: input.name.trim(),
          description: input.description?.trim(),
          triggerType: input.configuration.triggerType,
          enabled: input.enabled ?? false,
          assignedAgentId: input.configuration.assignedAgentId,
          rules: {
            create: {
              delayMinutes: input.configuration.delayMinutes,
              actionType: input.configuration.actionType,
              templateId: messageTemplate.id,
              conditions: {
                ...input.configuration.conditions,
                timing: input.configuration.timing,
              } as Prisma.InputJsonValue,
            },
          },
        },
        include: { rules: { include: { template: true } } },
      });
      await tx.auditEvent.create({
        data: {
          organizationId,
          action: "workflow.created",
          entityType: "AutomationWorkflow",
          entityId: workflow.id,
        },
      });
      return workflow;
    });
  }

  private async validateConfiguration(
    organizationId: string,
    configuration: WorkflowConfiguration,
  ) {
    if (!configuration.messageTemplate.trim())
      throw new BadRequestException("Workflow message template is required.");
    if (!Number.isInteger(configuration.delayMinutes) || configuration.delayMinutes < 0)
      throw new BadRequestException("Workflow delay must be a non-negative whole number.");
    if (configuration.assignedAgentId) {
      const agent = await this.prisma.agent.findFirst({
        where: {
          id: configuration.assignedAgentId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!agent) throw new NotFoundException("Assigned agent not found.");
    }
  }
}

function mergeConfiguration(
  base: WorkflowConfiguration,
  customization: WorkflowCustomization,
): WorkflowConfiguration {
  return {
    ...base,
    delayMinutes: customization.delayMinutes ?? base.delayMinutes,
    timing: customization.timing ?? base.timing,
    actionType: customization.actionType ?? base.actionType,
    messageTemplate: customization.messageTemplate?.trim() || base.messageTemplate,
    emailSubject:
      customization.emailSubject === undefined ? base.emailSubject : customization.emailSubject,
    conditions: customization.conditions ?? base.conditions,
    assignedAgentId:
      customization.assignedAgentId === undefined
        ? base.assignedAgentId
        : customization.assignedAgentId,
  };
}

function uniqueMessageTemplateName(name: string, templateId: string) {
  return `${name} ${templateId.slice(0, 8)}`;
}
