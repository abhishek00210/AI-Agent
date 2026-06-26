ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "industry" TEXT,
  ADD COLUMN IF NOT EXISTS "companySize" TEXT,
  ADD COLUMN IF NOT EXISTS "provisionStatus" TEXT NOT NULL DEFAULT 'PROVISIONED';

CREATE INDEX IF NOT EXISTS "Organization_provisionStatus_idx" ON "Organization"("provisionStatus");

UPDATE "Organization"
SET "dateFormat" = 'dd-MM-yyyy',
    "timeFormat" = 'hh:mm a'
WHERE "country" = 'IN';
