ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'BOOKED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'LOST';

CREATE TYPE "LeadSource" AS ENUM ('VOICE', 'CHAT', 'WIDGET', 'MANUAL', 'IMPORT', 'AI_AGENT');
CREATE TYPE "TimelineEventType" AS ENUM ('CALL', 'CHAT', 'APPOINTMENT', 'SMS', 'EMAIL', 'NOTE');

ALTER TABLE "contacts"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "preferredLanguage" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "contacts"
SET
  "firstName" = NULLIF(split_part(trim("name"), ' ', 1), ''),
  "lastName" = NULLIF(trim(substr(trim("name"), length(split_part(trim("name"), ' ', 1)) + 1)), '')
WHERE "firstName" IS NULL AND "lastName" IS NULL;

ALTER TABLE "leads"
  ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastInteractionAt" TIMESTAMP(3),
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "leads"
  ALTER COLUMN "source" DROP DEFAULT;

ALTER TABLE "leads"
  ALTER COLUMN "source" TYPE "LeadSource" USING
    CASE
      WHEN "source" IN ('VOICE', 'CHAT', 'WIDGET', 'MANUAL', 'IMPORT', 'AI_AGENT') THEN "source"::"LeadSource"
      ELSE 'AI_AGENT'::"LeadSource"
    END;

ALTER TABLE "leads"
  ALTER COLUMN "source" SET DEFAULT 'AI_AGENT';

CREATE TABLE "lead_timeline_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" "TimelineEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lead_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contacts_organizationId_updatedAt_idx" ON "contacts"("organizationId", "updatedAt");
CREATE INDEX "contacts_deletedAt_idx" ON "contacts"("deletedAt");

CREATE INDEX "leads_organizationId_contactId_idx" ON "leads"("organizationId", "contactId");
CREATE UNIQUE INDEX "leads_organizationId_contactId_key" ON "leads"("organizationId", "contactId");
CREATE INDEX "leads_organizationId_status_lastInteractionAt_idx" ON "leads"("organizationId", "status", "lastInteractionAt");
CREATE INDEX "leads_organizationId_source_lastInteractionAt_idx" ON "leads"("organizationId", "source", "lastInteractionAt");
CREATE INDEX "leads_deletedAt_idx" ON "leads"("deletedAt");

CREATE INDEX "lead_timeline_events_organizationId_idx" ON "lead_timeline_events"("organizationId");
CREATE INDEX "lead_timeline_events_leadId_idx" ON "lead_timeline_events"("leadId");
CREATE INDEX "lead_timeline_events_organizationId_leadId_createdAt_idx" ON "lead_timeline_events"("organizationId", "leadId", "createdAt");
CREATE INDEX "lead_timeline_events_organizationId_type_createdAt_idx" ON "lead_timeline_events"("organizationId", "type", "createdAt");
CREATE INDEX "lead_timeline_events_referenceType_referenceId_idx" ON "lead_timeline_events"("referenceType", "referenceId");

ALTER TABLE "lead_timeline_events"
  ADD CONSTRAINT "lead_timeline_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_timeline_events"
  ADD CONSTRAINT "lead_timeline_events_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
