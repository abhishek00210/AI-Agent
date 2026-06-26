CREATE TYPE "CustomerLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'CUSTOMER', 'LOST');
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'CUSTOMER_PROFILES_CREATED';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'CUSTOMER_PROFILES_UPDATED';

CREATE TABLE "customer_profiles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "company" TEXT,
  "address" JSONB,
  "totalCalls" INTEGER NOT NULL DEFAULT 0,
  "totalAppointments" INTEGER NOT NULL DEFAULT 0,
  "totalConversations" INTEGER NOT NULL DEFAULT 0,
  "totalMessages" INTEGER NOT NULL DEFAULT 0,
  "totalAiInteractions" INTEGER NOT NULL DEFAULT 0,
  "leadStatus" "CustomerLeadStatus" NOT NULL DEFAULT 'NEW',
  "lastContactAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_profiles_contactId_key" ON "customer_profiles"("contactId");
CREATE UNIQUE INDEX "customer_profiles_organizationId_phone_key" ON "customer_profiles"("organizationId", "phone");
CREATE UNIQUE INDEX "customer_profiles_organizationId_email_key" ON "customer_profiles"("organizationId", "email");
CREATE INDEX "customer_profiles_organizationId_idx" ON "customer_profiles"("organizationId");
CREATE INDEX "customer_profiles_organizationId_lastContactAt_idx" ON "customer_profiles"("organizationId", "lastContactAt");
CREATE INDEX "customer_profiles_phone_idx" ON "customer_profiles"("phone");
CREATE INDEX "customer_profiles_email_idx" ON "customer_profiles"("email");
CREATE INDEX "customer_profiles_leadStatus_idx" ON "customer_profiles"("leadStatus");
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "customer_profiles" ("id", "organizationId", "contactId", "name", "phone", "email", "company", "notes", "firstSeenAt", "lastSeenAt", "lastContactAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."organizationId", c."id", c."name", c."phone", c."email", c."company", c."notes", c."createdAt", c."updatedAt", c."updatedAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "contacts" c WHERE c."deletedAt" IS NULL
ON CONFLICT ("contactId") DO NOTHING;
