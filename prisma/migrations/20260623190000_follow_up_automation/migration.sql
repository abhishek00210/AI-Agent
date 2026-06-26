ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AUTOMATION_EXECUTIONS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AUTOMATION_SMS_SENT';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AUTOMATION_EMAILS_SENT';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AUTOMATION_CALLS_SCHEDULED';

ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_SCHEDULED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_CANCELLED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_FAILED';

CREATE TYPE "AutomationTriggerType" AS ENUM ('NEW_LEAD', 'MISSED_APPOINTMENT', 'APPOINTMENT_COMPLETED', 'NO_RESPONSE');
CREATE TYPE "AutomationActionType" AS ENUM ('CALL', 'SMS', 'EMAIL');
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "automation_workflows" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "triggerType" "AutomationTriggerType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_templates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "actionType" "AutomationActionType" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_rules" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  "actionType" "AutomationActionType" NOT NULL,
  "templateId" TEXT,
  "conditions" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_executions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "triggerType" "AutomationTriggerType" NOT NULL,
  "actionType" "AutomationActionType" NOT NULL,
  "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "followUpReason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_workflows_organizationId_triggerType_name_key" ON "automation_workflows"("organizationId", "triggerType", "name");
CREATE INDEX "automation_workflows_organizationId_idx" ON "automation_workflows"("organizationId");
CREATE INDEX "automation_workflows_organizationId_triggerType_enabled_idx" ON "automation_workflows"("organizationId", "triggerType", "enabled");
CREATE UNIQUE INDEX "automation_templates_organizationId_name_actionType_key" ON "automation_templates"("organizationId", "name", "actionType");
CREATE INDEX "automation_templates_organizationId_actionType_enabled_idx" ON "automation_templates"("organizationId", "actionType", "enabled");
CREATE INDEX "automation_rules_workflowId_enabled_idx" ON "automation_rules"("workflowId", "enabled");
CREATE INDEX "automation_rules_templateId_idx" ON "automation_rules"("templateId");
CREATE UNIQUE INDEX "automation_executions_organizationId_idempotencyKey_key" ON "automation_executions"("organizationId", "idempotencyKey");
CREATE INDEX "automation_executions_organizationId_idx" ON "automation_executions"("organizationId");
CREATE INDEX "automation_executions_workflowId_idx" ON "automation_executions"("workflowId");
CREATE INDEX "automation_executions_ruleId_idx" ON "automation_executions"("ruleId");
CREATE INDEX "automation_executions_customerProfileId_scheduledFor_idx" ON "automation_executions"("customerProfileId", "scheduledFor");
CREATE INDEX "automation_executions_organizationId_status_scheduledFor_idx" ON "automation_executions"("organizationId", "status", "scheduledFor");

ALTER TABLE "automation_workflows" ADD CONSTRAINT "automation_workflows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_templates" ADD CONSTRAINT "automation_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "automation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "automation_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
