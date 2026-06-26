CREATE TYPE "UsageResource" AS ENUM (
  'AI_MINUTES',
  'REALTIME_VOICE_MINUTES',
  'INCOMING_CALLS',
  'OUTGOING_CALLS',
  'MESSAGES',
  'SMS_MESSAGES',
  'AI_INPUT_TOKENS',
  'AI_OUTPUT_TOKENS',
  'KNOWLEDGE_STORAGE_MB',
  'KNOWLEDGE_BASES',
  'AGENTS',
  'APPOINTMENTS',
  'PHONE_NUMBERS',
  'WIDGETS',
  'CALENDAR_CONNECTIONS',
  'TOOL_EXECUTIONS'
);

CREATE TABLE "usage_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resourceType" "UsageResource" NOT NULL,
  "quantity" DECIMAL(20,6) NOT NULL,
  "idempotencyKey" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_counters" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resourceType" "UsageResource" NOT NULL,
  "currentValue" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "billingPeriodStart" TIMESTAMP(3) NOT NULL,
  "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_events_organizationId_idempotencyKey_key"
  ON "usage_events"("organizationId", "idempotencyKey");
CREATE INDEX "usage_events_organizationId_idx" ON "usage_events"("organizationId");
CREATE INDEX "usage_events_resourceType_idx" ON "usage_events"("resourceType");
CREATE INDEX "usage_events_organizationId_resourceType_createdAt_idx"
  ON "usage_events"("organizationId", "resourceType", "createdAt");

CREATE UNIQUE INDEX "usage_counters_organizationId_resourceType_billingPeriodStart_key"
  ON "usage_counters"("organizationId", "resourceType", "billingPeriodStart");
CREATE INDEX "usage_counters_organizationId_idx" ON "usage_counters"("organizationId");
CREATE INDEX "usage_counters_resourceType_idx" ON "usage_counters"("resourceType");
CREATE INDEX "usage_counters_billingPeriodStart_idx" ON "usage_counters"("billingPeriodStart");
CREATE INDEX "usage_counters_organizationId_billingPeriodStart_billingPeriodEnd_idx"
  ON "usage_counters"("organizationId", "billingPeriodStart", "billingPeriodEnd");

ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
