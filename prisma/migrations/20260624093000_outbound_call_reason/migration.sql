-- CreateEnum
CREATE TYPE "OutboundCallReason" AS ENUM ('LEAD_FOLLOW_UP', 'MISSED_APPOINTMENT', 'QUOTE_FOLLOW_UP', 'REVIEW_REQUEST', 'MANUAL_CALL', 'REACTIVATION', 'APPOINTMENT_REMINDER');

-- AlterTable
ALTER TABLE "automation_executions"
  ADD COLUMN "reasonType" "OutboundCallReason" NOT NULL DEFAULT 'MANUAL_CALL',
  ADD COLUMN "reasonDescription" TEXT NOT NULL DEFAULT '';

-- Backfill existing executions so older workflow history has a durable typed handoff description.
UPDATE "automation_executions"
SET
  "reasonDescription" = COALESCE(NULLIF("followUpReason", ''), 'Outbound follow-up.'),
  "reasonType" = CASE
    WHEN "triggerType" = 'NEW_LEAD' THEN 'LEAD_FOLLOW_UP'::"OutboundCallReason"
    WHEN "triggerType" = 'MISSED_APPOINTMENT' THEN 'MISSED_APPOINTMENT'::"OutboundCallReason"
    WHEN "triggerType" = 'APPOINTMENT_COMPLETED' THEN 'REVIEW_REQUEST'::"OutboundCallReason"
    WHEN "triggerType" = 'NO_RESPONSE' THEN 'REACTIVATION'::"OutboundCallReason"
    WHEN "triggerType" = 'UPCOMING_APPOINTMENT' THEN 'APPOINTMENT_REMINDER'::"OutboundCallReason"
    WHEN "triggerType" = 'QUOTE_SENT' THEN 'QUOTE_FOLLOW_UP'::"OutboundCallReason"
    ELSE 'MANUAL_CALL'::"OutboundCallReason"
  END;
