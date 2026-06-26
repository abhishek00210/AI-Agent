ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'WORKFLOW_TEMPLATE_ACTIVATIONS';
ALTER TYPE "AutomationTriggerType" ADD VALUE IF NOT EXISTS 'UPCOMING_APPOINTMENT';
ALTER TYPE "AutomationTriggerType" ADD VALUE IF NOT EXISTS 'QUOTE_SENT';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'WORKFLOW_CREATED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'WORKFLOW_ENABLED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'WORKFLOW_TRIGGERED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'WORKFLOW_COMPLETED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'WORKFLOW_CANCELLED';

CREATE TYPE "WorkflowTemplateCategory" AS ENUM ('LEAD', 'APPOINTMENT', 'REVIEW', 'QUOTE', 'CUSTOM');

ALTER TABLE "automation_workflows"
ADD COLUMN "assignedAgentId" TEXT,
ADD COLUMN "sourceTemplateId" TEXT,
ADD COLUMN "sourceTemplateVersion" INTEGER;

CREATE UNIQUE INDEX "automation_workflows_organizationId_sourceTemplateId_key"
ON "automation_workflows"("organizationId", "sourceTemplateId");

CREATE TABLE "workflow_templates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "WorkflowTemplateCategory" NOT NULL,
  "systemTemplate" BOOLEAN NOT NULL DEFAULT false,
  "triggerType" "AutomationTriggerType" NOT NULL,
  "defaultConfiguration" JSONB NOT NULL,
  "estimatedConversionImpact" INTEGER NOT NULL DEFAULT 3,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_templates_impact_check" CHECK ("estimatedConversionImpact" BETWEEN 1 AND 5)
);

CREATE TABLE "workflow_template_versions" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_templates_organizationId_name_key"
ON "workflow_templates"("organizationId", "name");
CREATE INDEX "workflow_templates_organizationId_enabled_idx"
ON "workflow_templates"("organizationId", "enabled");
CREATE INDEX "workflow_templates_systemTemplate_category_enabled_idx"
ON "workflow_templates"("systemTemplate", "category", "enabled");
CREATE UNIQUE INDEX "workflow_template_versions_templateId_version_key"
ON "workflow_template_versions"("templateId", "version");
CREATE INDEX "workflow_template_versions_templateId_createdAt_idx"
ON "workflow_template_versions"("templateId", "createdAt");

ALTER TABLE "workflow_templates"
ADD CONSTRAINT "workflow_templates_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_template_versions"
ADD CONSTRAINT "workflow_template_versions_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
