DO $$ BEGIN
  CREATE TYPE "ExternalPhoneNumberStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE', 'FAILED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExternalNumberVerificationMethod" AS ENUM ('SMS', 'VOICE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'EXTERNAL_PHONE_NUMBERS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'PHONE_VERIFICATION_ATTEMPTS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'PHONE_FORWARDING_TESTS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'PHONE_FORWARDING_ACTIVATIONS';

CREATE TABLE "external_phone_numbers" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "status" "ExternalPhoneNumberStatus" NOT NULL DEFAULT 'PENDING',
  "assignedAgentId" TEXT,
  "forwardingTargetPhoneNumberId" TEXT,
  "forwardingTargetNumber" TEXT,
  "verificationMethod" "ExternalNumberVerificationMethod" NOT NULL DEFAULT 'SMS',
  "verificationCodeHash" TEXT,
  "verificationExpiresAt" TIMESTAMP(3),
  "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
  "verificationSendCount" INTEGER NOT NULL DEFAULT 0,
  "verificationWindowStartedAt" TIMESTAMP(3),
  "lastVerificationSentAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "lastTestCallAt" TIMESTAMP(3),
  "forwardingConfirmedAt" TIMESTAMP(3),
  "testSessionHash" TEXT,
  "testStartedAt" TIMESTAMP(3),
  "testExpiresAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_phone_numbers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_phone_numbers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "external_phone_numbers_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "external_phone_numbers_forwardingTargetPhoneNumberId_fkey" FOREIGN KEY ("forwardingTargetPhoneNumberId") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "external_phone_numbers_phoneNumber_key" ON "external_phone_numbers"("phoneNumber");
CREATE INDEX "external_phone_numbers_organizationId_idx" ON "external_phone_numbers"("organizationId");
CREATE INDEX "external_phone_numbers_phoneNumber_idx" ON "external_phone_numbers"("phoneNumber");
CREATE INDEX "external_phone_numbers_status_idx" ON "external_phone_numbers"("status");
CREATE INDEX "external_phone_numbers_organizationId_status_idx" ON "external_phone_numbers"("organizationId", "status");
CREATE INDEX "external_phone_numbers_forwardingTargetPhoneNumberId_testExpiresAt_idx" ON "external_phone_numbers"("forwardingTargetPhoneNumberId", "testExpiresAt");
