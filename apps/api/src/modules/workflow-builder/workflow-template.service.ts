import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import type {
  AutomationTriggerType,
  Prisma,
  WorkflowTemplateCategory,
} from "../../../generated/prisma";
import { PrismaService } from "../../database/prisma.service";
import { SYSTEM_WORKFLOW_TEMPLATES } from "./system-workflow-templates";
import { parseWorkflowConfiguration } from "./workflow-builder.types";

@Injectable()
export class WorkflowTemplateService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.ensureSystemTemplates().catch((error: unknown) => {
      this.logger.error(
        "Unable to seed workflow templates during startup.",
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async ensureSystemTemplates() {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('workflow-system-templates-v1'))`;
      for (const definition of SYSTEM_WORKFLOW_TEMPLATES) {
        let template = await tx.workflowTemplate.findFirst({
          where: { organizationId: null, systemTemplate: true, name: definition.name },
        });
        const configuration = definition.configuration as unknown as Prisma.InputJsonValue;
        if (!template) {
          template = await tx.workflowTemplate.create({
            data: {
              name: definition.name,
              description: definition.description,
              category: definition.category,
              systemTemplate: true,
              triggerType: definition.triggerType,
              defaultConfiguration: configuration,
              estimatedConversionImpact: definition.estimatedConversionImpact,
            },
          });
        }
        await tx.workflowTemplateVersion.upsert({
          where: { templateId_version: { templateId: template.id, version: 1 } },
          create: { templateId: template.id, version: 1, configuration },
          update: {},
        });
      }
    });
  }

  async list(organizationId: string, category?: WorkflowTemplateCategory) {
    await this.ensureSystemTemplates();
    return this.prisma.workflowTemplate.findMany({
      where: {
        enabled: true,
        ...(category ? { category } : {}),
        OR: [{ organizationId: null, systemTemplate: true }, { organizationId }],
      },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      orderBy: [{ systemTemplate: "desc" }, { estimatedConversionImpact: "desc" }, { name: "asc" }],
    });
  }

  async get(organizationId: string, id: string) {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: {
        id,
        OR: [{ organizationId: null, systemTemplate: true }, { organizationId }],
      },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    if (!template) throw new NotFoundException("Workflow template not found.");
    return {
      ...template,
      configuration: parseWorkflowConfiguration(
        template.versions[0]?.configuration ?? template.defaultConfiguration,
      ),
    };
  }

  async adminList() {
    await this.ensureSystemTemplates();
    const [templates, adoption] = await Promise.all([
      this.prisma.workflowTemplate.findMany({
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
        orderBy: [{ systemTemplate: "desc" }, { name: "asc" }],
      }),
      this.prisma.automationWorkflow.groupBy({
        by: ["sourceTemplateId"],
        where: { sourceTemplateId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(adoption.map((row) => [row.sourceTemplateId, row._count._all]));
    return templates.map((template) => ({
      ...template,
      adoptionCount: counts.get(template.id) ?? 0,
    }));
  }

  async adminSetEnabled(id: string, enabled: boolean) {
    const template = await this.prisma.workflowTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException("Workflow template not found.");
    return this.prisma.workflowTemplate.update({ where: { id }, data: { enabled } });
  }

  async adminCreate(input: {
    name: string;
    description?: string;
    category: WorkflowTemplateCategory;
    triggerType: AutomationTriggerType;
    configuration: Prisma.InputJsonValue;
    estimatedConversionImpact: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: {
          name: input.name.trim(),
          description: input.description?.trim(),
          category: input.category,
          systemTemplate: true,
          triggerType: input.triggerType,
          defaultConfiguration: input.configuration,
          estimatedConversionImpact: input.estimatedConversionImpact,
        },
      });
      await tx.workflowTemplateVersion.create({
        data: { templateId: template.id, version: 1, configuration: input.configuration },
      });
      return template;
    });
  }
}
