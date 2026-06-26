CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "AppointmentSource" AS ENUM ('VOICE', 'CHAT', 'WIDGET', 'MANUAL');

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "appointments" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "contactId" TEXT,
  "conversationId" TEXT,
  "callId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
  "timezone" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "source" "AppointmentSource" NOT NULL DEFAULT 'MANUAL',
  "confirmationNumber" TEXT NOT NULL,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_valid_time_check" CHECK ("endTime" > "startTime")
);

CREATE TABLE "availability" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL,
  "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "availability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_day_check" CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
  CONSTRAINT "availability_buffer_check" CHECK ("bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0),
  CONSTRAINT "availability_time_format_check" CHECK (
    "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "startTime" < "endTime"
  )
);

CREATE UNIQUE INDEX "appointments_confirmationNumber_key" ON "appointments"("confirmationNumber");
CREATE INDEX "appointments_organizationId_idx" ON "appointments"("organizationId");
CREATE INDEX "appointments_agentId_idx" ON "appointments"("agentId");
CREATE INDEX "appointments_contactId_idx" ON "appointments"("contactId");
CREATE INDEX "appointments_conversationId_idx" ON "appointments"("conversationId");
CREATE INDEX "appointments_callId_idx" ON "appointments"("callId");
CREATE INDEX "appointments_startTime_idx" ON "appointments"("startTime");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");
CREATE INDEX "appointments_organizationId_agentId_startTime_idx" ON "appointments"("organizationId", "agentId", "startTime");
CREATE INDEX "appointments_organizationId_status_startTime_idx" ON "appointments"("organizationId", "status", "startTime");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_active_overlap"
  EXCLUDE USING gist (
    "organizationId" WITH =,
    "agentId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));

CREATE INDEX "availability_organizationId_idx" ON "availability"("organizationId");
CREATE INDEX "availability_organizationId_dayOfWeek_isEnabled_idx" ON "availability"("organizationId", "dayOfWeek", "isEnabled");
CREATE INDEX "availability_timezone_idx" ON "availability"("timezone");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "availability" ADD CONSTRAINT "availability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "appointments_organizationId_idempotencyKey_key" ON "appointments"("organizationId", "idempotencyKey");
