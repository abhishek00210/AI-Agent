CREATE TYPE "PhoneNumberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNASSIGNED');
CREATE TYPE "PhoneNumberProvider" AS ENUM ('TWILIO');
CREATE TYPE "TwilioConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

CREATE TABLE "phone_numbers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agentId" TEXT,
  "phoneNumber" TEXT NOT NULL,
  "friendlyName" TEXT,
  "country" TEXT,
  "capabilities" JSONB NOT NULL DEFAULT '{}',
  "provider" "PhoneNumberProvider" NOT NULL DEFAULT 'TWILIO',
  "status" "PhoneNumberStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "twilioSid" TEXT,
  "voiceWebhookUrl" TEXT,
  "smsWebhookUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "phone_numbers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "twilio_connections" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accountSid" TEXT NOT NULL,
  "friendlyName" TEXT,
  "status" "TwilioConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "twilio_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "phone_numbers_organizationId_phoneNumber_key" ON "phone_numbers"("organizationId", "phoneNumber");
CREATE INDEX "phone_numbers_organizationId_idx" ON "phone_numbers"("organizationId");
CREATE INDEX "phone_numbers_agentId_idx" ON "phone_numbers"("agentId");
CREATE INDEX "phone_numbers_phoneNumber_idx" ON "phone_numbers"("phoneNumber");
CREATE INDEX "phone_numbers_status_idx" ON "phone_numbers"("status");
CREATE INDEX "phone_numbers_provider_idx" ON "phone_numbers"("provider");
CREATE INDEX "phone_numbers_twilioSid_idx" ON "phone_numbers"("twilioSid");
CREATE INDEX "phone_numbers_createdAt_idx" ON "phone_numbers"("createdAt");
CREATE INDEX "phone_numbers_deletedAt_idx" ON "phone_numbers"("deletedAt");

CREATE UNIQUE INDEX "twilio_connections_organizationId_accountSid_key" ON "twilio_connections"("organizationId", "accountSid");
CREATE INDEX "twilio_connections_organizationId_idx" ON "twilio_connections"("organizationId");
CREATE INDEX "twilio_connections_status_idx" ON "twilio_connections"("status");
CREATE INDEX "twilio_connections_deletedAt_idx" ON "twilio_connections"("deletedAt");

ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "twilio_connections" ADD CONSTRAINT "twilio_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
