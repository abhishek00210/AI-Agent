DO $$ BEGIN
  CREATE TYPE "Country" AS ENUM ('CA', 'IN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "Currency" AS ENUM ('CAD', 'INR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "Language" AS ENUM ('en', 'fr', 'hi');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "country" "Country" NOT NULL DEFAULT 'CA',
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
  ADD COLUMN IF NOT EXISTS "language" "Language" NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS "telephonyProvider" "PhoneNumberProvider" NOT NULL DEFAULT 'TWILIO',
  ADD COLUMN IF NOT EXISTS "paymentProvider" "BillingProvider" NOT NULL DEFAULT 'STRIPE',
  ADD COLUMN IF NOT EXISTS "dateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
  ADD COLUMN IF NOT EXISTS "timeFormat" TEXT NOT NULL DEFAULT 'HH:mm',
  ADD COLUMN IF NOT EXISTS "numberFormat" TEXT NOT NULL DEFAULT '+1',
  ADD COLUMN IF NOT EXISTS "businessHoursTimezone" TEXT NOT NULL DEFAULT 'America/Toronto';

ALTER TABLE "Organization" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Organization"
  ALTER COLUMN "currency" TYPE "Currency"
  USING (
    CASE
      WHEN "currency" = 'INR' THEN 'INR'::"Currency"
      ELSE 'CAD'::"Currency"
    END
  );
ALTER TABLE "Organization" ALTER COLUMN "currency" SET DEFAULT 'CAD';

UPDATE "Organization"
SET
  "country" = CASE WHEN "countryCode" = 'IN' THEN 'IN'::"Country" ELSE 'CA'::"Country" END,
  "currency" = CASE WHEN "countryCode" = 'IN' THEN 'INR'::"Currency" ELSE 'CAD'::"Currency" END,
  "timezone" = CASE WHEN "countryCode" = 'IN' THEN 'Asia/Kolkata' ELSE 'America/Toronto' END,
  "language" = 'en'::"Language",
  "telephonyProvider" = CASE WHEN "countryCode" = 'IN' THEN 'EXOTEL'::"PhoneNumberProvider" ELSE 'TWILIO'::"PhoneNumberProvider" END,
  "paymentProvider" = CASE WHEN "countryCode" = 'IN' THEN 'RAZORPAY'::"BillingProvider" ELSE 'STRIPE'::"BillingProvider" END,
  "dateFormat" = CASE WHEN "countryCode" = 'IN' THEN 'dd/MM/yyyy' ELSE 'yyyy-MM-dd' END,
  "timeFormat" = 'HH:mm',
  "numberFormat" = CASE WHEN "countryCode" = 'IN' THEN '+91' ELSE '+1' END,
  "businessHoursTimezone" = CASE WHEN "countryCode" = 'IN' THEN 'Asia/Kolkata' ELSE 'America/Toronto' END,
  "taxRegion" = COALESCE("taxRegion", CASE WHEN "countryCode" = 'IN' THEN 'GST' ELSE 'GST/HST' END);

CREATE INDEX IF NOT EXISTS "Organization_country_idx" ON "Organization"("country");
CREATE INDEX IF NOT EXISTS "Organization_telephonyProvider_idx" ON "Organization"("telephonyProvider");
CREATE INDEX IF NOT EXISTS "Organization_paymentProvider_idx" ON "Organization"("paymentProvider");
