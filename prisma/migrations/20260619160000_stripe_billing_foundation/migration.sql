ALTER TYPE "OrganizationPlan" RENAME VALUE 'GROWTH' TO 'PRO';
ALTER TYPE "OrganizationPlan" RENAME VALUE 'ENTERPRISE' TO 'AGENCY';

CREATE TYPE "BillingProvider" AS ENUM ('STRIPE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE');
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PRO', 'AGENCY');

CREATE TABLE "billing_customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'STRIPE',
    "providerCustomerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "billingCustomerId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'STRIPE',
    "providerSubscriptionId" TEXT NOT NULL,
    "providerPriceId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'STRIPE',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_customers_organizationId_provider_key" ON "billing_customers"("organizationId", "provider");
CREATE UNIQUE INDEX "billing_customers_provider_providerCustomerId_key" ON "billing_customers"("provider", "providerCustomerId");
CREATE INDEX "billing_customers_organizationId_idx" ON "billing_customers"("organizationId");
CREATE INDEX "billing_customers_providerCustomerId_idx" ON "billing_customers"("providerCustomerId");
CREATE INDEX "billing_customers_status_idx" ON "billing_customers"("status");

CREATE UNIQUE INDEX "subscriptions_provider_providerSubscriptionId_key" ON "subscriptions"("provider", "providerSubscriptionId");
CREATE INDEX "subscriptions_organizationId_idx" ON "subscriptions"("organizationId");
CREATE INDEX "subscriptions_billingCustomerId_idx" ON "subscriptions"("billingCustomerId");
CREATE INDEX "subscriptions_providerSubscriptionId_idx" ON "subscriptions"("providerSubscriptionId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_organizationId_status_idx" ON "subscriptions"("organizationId", "status");

CREATE UNIQUE INDEX "billing_events_provider_eventId_key" ON "billing_events"("provider", "eventId");
CREATE INDEX "billing_events_organizationId_idx" ON "billing_events"("organizationId");
CREATE INDEX "billing_events_eventId_idx" ON "billing_events"("eventId");
CREATE INDEX "billing_events_processed_idx" ON "billing_events"("processed");
CREATE INDEX "billing_events_eventType_idx" ON "billing_events"("eventType");
CREATE INDEX "billing_events_createdAt_idx" ON "billing_events"("createdAt");

ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billingCustomerId_fkey" FOREIGN KEY ("billingCustomerId") REFERENCES "billing_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
