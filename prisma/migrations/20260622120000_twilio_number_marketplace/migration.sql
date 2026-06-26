CREATE TYPE "PurchaseSource" AS ENUM ('TWILIO', 'PORTED', 'EXTERNAL');

ALTER TABLE "phone_numbers"
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT,
  ADD COLUMN IF NOT EXISTS "areaCode" TEXT,
  ADD COLUMN IF NOT EXISTS "purchaseSource" "PurchaseSource",
  ADD COLUMN IF NOT EXISTS "monthlyCost" DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS "providerCost" DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS "customerPrice" DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS "profitMargin" DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS "isPurchased" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "purchasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);

UPDATE "phone_numbers"
SET
  "purchaseSource" = COALESCE("purchaseSource", 'TWILIO'::"PurchaseSource"),
  "countryCode" = COALESCE("countryCode", "country"),
  "isPurchased" = COALESCE("isPurchased", false)
WHERE "provider" = 'TWILIO';

CREATE INDEX IF NOT EXISTS "phone_numbers_purchaseSource_idx" ON "phone_numbers"("purchaseSource");
CREATE INDEX IF NOT EXISTS "phone_numbers_countryCode_idx" ON "phone_numbers"("countryCode");
CREATE INDEX IF NOT EXISTS "phone_numbers_isPurchased_idx" ON "phone_numbers"("isPurchased");
