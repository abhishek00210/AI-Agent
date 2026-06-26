ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "TrialStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED');

ALTER TYPE "OrganizationStatus" ADD VALUE IF NOT EXISTS 'TRIAL_EXPIRED';

ALTER TABLE "Organization"
  ADD COLUMN "trialStartsAt" TIMESTAMP(3),
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "trialStatus" "TrialStatus";

ALTER TABLE "subscriptions"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "pauseResumesAt" TIMESTAMP(3),
  ADD COLUMN "pendingPlan" "PlanType";

CREATE TABLE "billing_plans" (
  "id" TEXT NOT NULL,
  "plan" "PlanType" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "displayName" TEXT NOT NULL,
  "monthlyPriceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "providerPriceId" TEXT,
  "limits" JSONB NOT NULL,
  "features" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_feature_overrides" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "enabled" BOOLEAN,
  "limit" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_feature_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Organization_trialStatus_trialEndsAt_idx" ON "Organization"("trialStatus", "trialEndsAt");
CREATE INDEX "subscriptions_pauseResumesAt_idx" ON "subscriptions"("pauseResumesAt");
CREATE UNIQUE INDEX "billing_plans_plan_version_key" ON "billing_plans"("plan", "version");
CREATE INDEX "billing_plans_plan_active_idx" ON "billing_plans"("plan", "active");
CREATE UNIQUE INDEX "organization_feature_overrides_organizationId_feature_key" ON "organization_feature_overrides"("organizationId", "feature");
CREATE INDEX "organization_feature_overrides_organizationId_idx" ON "organization_feature_overrides"("organizationId");
CREATE INDEX "organization_feature_overrides_expiresAt_idx" ON "organization_feature_overrides"("expiresAt");

ALTER TABLE "organization_feature_overrides"
  ADD CONSTRAINT "organization_feature_overrides_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "billing_plans" (
  "id", "plan", "version", "displayName", "monthlyPriceCents", "currency", "limits", "features", "active", "updatedAt"
) VALUES
  ('00000000-0000-4000-8000-000000000101', 'STARTER', 1, 'Starter', 9900, 'CAD',
   '{"agents":1,"voiceMinutes":500,"sms":500,"chatMessages":5000,"knowledgeBases":10,"phoneNumbers":1,"widgets":1}',
   '{"googleCalendar":true,"appointments":true,"crm":true,"websiteWidget":true,"apiAccess":false,"prioritySupport":false,"advancedAnalytics":false,"realtimeVoice":true}', true, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000102', 'PRO', 1, 'Pro', 19900, 'CAD',
   '{"agents":5,"voiceMinutes":2500,"sms":2500,"chatMessages":25000,"knowledgeBases":50,"phoneNumbers":10,"widgets":1}',
   '{"googleCalendar":true,"appointments":true,"crm":true,"websiteWidget":true,"apiAccess":true,"prioritySupport":true,"advancedAnalytics":true,"realtimeVoice":true}', true, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000103', 'AGENCY', 1, 'Agency', 39900, 'CAD',
   '{"agents":null,"voiceMinutes":10000,"sms":10000,"chatMessages":null,"knowledgeBases":null,"phoneNumbers":null,"widgets":null}',
   '{"googleCalendar":true,"appointments":true,"crm":true,"websiteWidget":true,"apiAccess":true,"prioritySupport":true,"advancedAnalytics":true,"realtimeVoice":true}', true, CURRENT_TIMESTAMP);
