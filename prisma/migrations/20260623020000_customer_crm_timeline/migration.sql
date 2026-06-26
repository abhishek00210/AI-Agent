CREATE TYPE "CustomerTimelineEventType" AS ENUM ('CUSTOMER_CREATED','CALL_RECEIVED','CALL_COMPLETED','CONVERSATION_STARTED','CONVERSATION_COMPLETED','LEAD_CREATED','LEAD_STATUS_CHANGED','APPOINTMENT_BOOKED','APPOINTMENT_RESCHEDULED','APPOINTMENT_CANCELLED','SMS_SENT','SMS_RECEIVED','EMAIL_SENT','EMAIL_RECEIVED','FOLLOW_UP_SENT','NOTE_ADDED','AI_SUMMARY_GENERATED','OUTBOUND_CALL_COMPLETED');
CREATE TYPE "CustomerTimelineCategory" AS ENUM ('CUSTOMER','VOICE','SMS','EMAIL','LEAD','APPOINTMENT','AI','SYSTEM');
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'TIMELINE_WRITES';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'TIMELINE_READS';
CREATE TABLE "customer_timeline_events" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "customerProfileId" TEXT NOT NULL,
  "eventType" "CustomerTimelineEventType" NOT NULL, "eventCategory" "CustomerTimelineCategory" NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "sourceEntityType" TEXT, "sourceEntityId" TEXT,
  "idempotencyKey" TEXT NOT NULL, "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_timeline_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_timeline_events_organizationId_idempotencyKey_key" ON "customer_timeline_events"("organizationId","idempotencyKey");
CREATE INDEX "customer_timeline_events_organizationId_idx" ON "customer_timeline_events"("organizationId");
CREATE INDEX "customer_timeline_events_customerProfileId_idx" ON "customer_timeline_events"("customerProfileId");
CREATE INDEX "customer_timeline_events_eventType_idx" ON "customer_timeline_events"("eventType");
CREATE INDEX "customer_timeline_events_occurredAt_idx" ON "customer_timeline_events"("occurredAt");
CREATE INDEX "customer_timeline_events_org_customer_occurred_id_idx" ON "customer_timeline_events"("organizationId","customerProfileId","occurredAt" DESC,"id" DESC);
ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_timeline_events" ADD CONSTRAINT "customer_timeline_events_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "customer_timeline_events" ("id","organizationId","customerProfileId","eventType","eventCategory","title","description","sourceEntityType","sourceEntityId","idempotencyKey","metadata","occurredAt","createdAt")
SELECT gen_random_uuid()::text, cp."organizationId", cp."id", 'CUSTOMER_CREATED', 'CUSTOMER', 'Customer created', 'Customer profile created from existing contact.', 'Contact', cp."contactId", 'customer:created:' || cp."id", '{}', cp."firstSeenAt", CURRENT_TIMESTAMP FROM "customer_profiles" cp ON CONFLICT DO NOTHING;
