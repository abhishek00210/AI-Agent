-- Day 51 outbound calling foundation hardening.
-- Keep previously shipped qualification-specific values for backward compatibility,
-- while adding the generic foundation states/reasons and direct artifact links.

ALTER TYPE "OutboundCallReasonType" ADD VALUE IF NOT EXISTS 'AUTOMATION_CALL';
ALTER TYPE "OutboundCallReasonType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE "OutboundCallReasonType" ADD VALUE IF NOT EXISTS 'SYSTEM_TRIGGER';

ALTER TYPE "OutboundCallStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'OUTBOUND_RECORDINGS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'OUTBOUND_TRANSCRIPTS';

ALTER TABLE "outbound_calls"
  ADD COLUMN IF NOT EXISTS "recordingId" TEXT,
  ADD COLUMN IF NOT EXISTS "transcriptId" TEXT;

DO $$
BEGIN
  ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_recordingId_key" UNIQUE ("recordingId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_transcriptId_key" UNIQUE ("transcriptId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_recordingId_fkey"
    FOREIGN KEY ("recordingId") REFERENCES "call_recordings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "outbound_calls" ADD CONSTRAINT "outbound_calls_transcriptId_fkey"
    FOREIGN KEY ("transcriptId") REFERENCES "call_transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "outbound_calls_recordingId_idx" ON "outbound_calls"("recordingId");
CREATE INDEX IF NOT EXISTS "outbound_calls_transcriptId_idx" ON "outbound_calls"("transcriptId");
