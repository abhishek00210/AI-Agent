ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS "gstNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "billingCompanyName" TEXT,
  ADD COLUMN IF NOT EXISTS "billingAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "taxRegion" TEXT;

CREATE INDEX IF NOT EXISTS "Organization_countryCode_idx" ON "Organization"("countryCode");
