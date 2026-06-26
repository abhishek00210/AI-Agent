DO $$ BEGIN
  CREATE TYPE "BillingAddonType" AS ENUM ('PHONE_NUMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingAddonStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "billing_addons" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "type" "BillingAddonType" NOT NULL,
  "status" "BillingAddonStatus" NOT NULL DEFAULT 'PENDING',
  "providerPriceId" TEXT NOT NULL,
  "providerSubscriptionItemId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "unitAmountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_addons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_addons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "billing_addons_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_addons_organizationId_type_key" ON "billing_addons"("organizationId", "type");
CREATE INDEX IF NOT EXISTS "billing_addons_subscriptionId_idx" ON "billing_addons"("subscriptionId");
CREATE INDEX IF NOT EXISTS "billing_addons_status_idx" ON "billing_addons"("status");
