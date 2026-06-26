CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ROUTING', 'CONNECTED', 'COMPLETED', 'FAILED', 'MISSED');

CREATE TABLE "calls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "twilioCallSid" TEXT NOT NULL,
  "callerNumber" TEXT NOT NULL,
  "calledNumber" TEXT NOT NULL,
  "direction" "CallDirection" NOT NULL,
  "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calls_twilioCallSid_key" ON "calls"("twilioCallSid");
CREATE INDEX "calls_organizationId_idx" ON "calls"("organizationId");
CREATE INDEX "calls_phoneNumberId_idx" ON "calls"("phoneNumberId");
CREATE INDEX "calls_agentId_idx" ON "calls"("agentId");
CREATE INDEX "calls_twilioCallSid_idx" ON "calls"("twilioCallSid");
CREATE INDEX "calls_status_idx" ON "calls"("status");
CREATE INDEX "calls_startedAt_idx" ON "calls"("startedAt");

ALTER TABLE "calls" ADD CONSTRAINT "calls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
