ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'CAMPAIGN_TARGETS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'CAMPAIGN_CALLS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'CAMPAIGN_MINUTES';

ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_CREATED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_STARTED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_COMPLETED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_CANCELLED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_CALL_CREATED';

DO $$ BEGIN CREATE TYPE "CampaignType" AS ENUM ('FOLLOW_UP', 'RE_ENGAGEMENT', 'REMINDER', 'SALES_OUTREACH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignScheduleType" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'RECURRING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignTargetStatus" AS ENUM ('PENDING', 'QUEUED', 'CALL_CREATED', 'COMPLETED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "campaignType" "CampaignType" NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "assignedAgentId" TEXT NOT NULL,
  "scheduleType" "CampaignScheduleType" NOT NULL DEFAULT 'IMMEDIATE',
  "scheduledAt" TIMESTAMP(3),
  "recurrence" JSONB,
  "targetingFilters" JSONB NOT NULL DEFAULT '{}',
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "callsCreated" INTEGER NOT NULL DEFAULT 0,
  "callsCompleted" INTEGER NOT NULL DEFAULT 0,
  "connectedCalls" INTEGER NOT NULL DEFAULT 0,
  "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
  "appointmentsBooked" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "campaign_targets" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "leadId" TEXT,
  "outboundCallId" TEXT,
  "status" "CampaignTargetStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_targets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaigns_organizationId_idx" ON "campaigns"("organizationId");
CREATE INDEX IF NOT EXISTS "campaigns_organizationId_status_scheduledAt_idx" ON "campaigns"("organizationId", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "campaigns_assignedAgentId_idx" ON "campaigns"("assignedAgentId");
CREATE INDEX IF NOT EXISTS "campaigns_campaignType_idx" ON "campaigns"("campaignType");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_targets_outboundCallId_key" ON "campaign_targets"("outboundCallId");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_targets_campaignId_customerProfileId_key" ON "campaign_targets"("campaignId", "customerProfileId");
CREATE INDEX IF NOT EXISTS "campaign_targets_campaignId_status_idx" ON "campaign_targets"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "campaign_targets_customerProfileId_idx" ON "campaign_targets"("customerProfileId");
CREATE INDEX IF NOT EXISTS "campaign_targets_leadId_idx" ON "campaign_targets"("leadId");

DO $$ BEGIN ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_outboundCallId_fkey" FOREIGN KEY ("outboundCallId") REFERENCES "outbound_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
