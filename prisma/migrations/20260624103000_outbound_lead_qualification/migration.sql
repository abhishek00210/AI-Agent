-- AddEnumValues
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALLS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'OUTBOUND_MINUTES';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'QUALIFICATION_ATTEMPTS';

ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALL_CREATED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALL_STARTED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALL_FAILED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'LEAD_QUALIFIED';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "OutboundCallReasonType" AS ENUM ('LEAD_FOLLOW_UP', 'QUOTE_FOLLOW_UP', 'MISSED_APPOINTMENT', 'REVIEW_REQUEST', 'MANUAL_CALL', 'REACTIVATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "OutboundCallStatus" AS ENUM ('PENDING', 'DIALING', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER', 'VOICEMAIL', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "outbound_calls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "leadId" TEXT,
  "callId" TEXT,
  "agentId" TEXT NOT NULL,
  "phoneNumberId" TEXT,
  "automationExecutionId" TEXT,
  "reasonType" "OutboundCallReasonType" NOT NULL,
  "reasonDescription" TEXT NOT NULL,
  "status" "OutboundCallStatus" NOT NULL DEFAULT 'PENDING',
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "appointmentBooked" BOOLEAN NOT NULL DEFAULT false,
  "qualified" BOOLEAN NOT NULL DEFAULT false,
  "summaryId" TEXT,
  "provider" "CommunicationProvider" NOT NULL DEFAULT 'TWILIO',
  "providerCallSid" TEXT,
  "lastError" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "outbound_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_calls_callId_key" ON "outbound_calls"("callId");
CREATE UNIQUE INDEX "outbound_calls_summaryId_key" ON "outbound_calls"("summaryId");
CREATE UNIQUE INDEX "outbound_calls_providerCallSid_key" ON "outbound_calls"("providerCallSid");
CREATE INDEX "outbound_calls_organizationId_idx" ON "outbound_calls"("organizationId");
CREATE INDEX "outbound_calls_customerProfileId_idx" ON "outbound_calls"("customerProfileId");
CREATE INDEX "outbound_calls_leadId_idx" ON "outbound_calls"("leadId");
CREATE INDEX "outbound_calls_callId_idx" ON "outbound_calls"("callId");
CREATE INDEX "outbound_calls_agentId_idx" ON "outbound_calls"("agentId");
CREATE INDEX "outbound_calls_status_idx" ON "outbound_calls"("status");
CREATE INDEX "outbound_calls_reasonType_idx" ON "outbound_calls"("reasonType");
CREATE INDEX "outbound_calls_scheduledAt_idx" ON "outbound_calls"("scheduledAt");
CREATE INDEX "outbound_calls_providerCallSid_idx" ON "outbound_calls"("providerCallSid");
CREATE INDEX "outbound_calls_organizationId_status_scheduledAt_idx" ON "outbound_calls"("organizationId", "status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_automationExecutionId_fkey" FOREIGN KEY ("automationExecutionId") REFERENCES "automation_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "call_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
