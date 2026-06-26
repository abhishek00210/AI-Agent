CREATE TYPE "CallSource" AS ENUM ('VOICE', 'WIDGET', 'INTERNAL');
CREATE TYPE "CallEndReason" AS ENUM ('CALLER_HANGUP', 'AI_HANGUP', 'TIMEOUT', 'ERROR', 'TRANSFER', 'UNKNOWN');

ALTER TABLE "calls"
ADD COLUMN "conversationId" TEXT,
ADD COLUMN "callRecordingId" TEXT,
ADD COLUMN "callTranscriptId" TEXT,
ADD COLUMN "answeredAt" TIMESTAMP(3),
ADD COLUMN "endReason" "CallEndReason" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "source" "CallSource" NOT NULL DEFAULT 'VOICE';

UPDATE "calls" call
SET "conversationId" = realtime."conversationId"
FROM (
  SELECT DISTINCT ON ("callId") "callId", "conversationId"
  FROM "realtime_sessions"
  WHERE "conversationId" IS NOT NULL
  ORDER BY "callId", "createdAt" DESC
) realtime
WHERE realtime."callId" = call."id";

UPDATE "calls" call
SET "callRecordingId" = recording."id"
FROM (
  SELECT DISTINCT ON ("callId") "callId", "id"
  FROM "call_recordings"
  WHERE "status" <> 'DELETED'
  ORDER BY "callId", "createdAt" DESC
) recording
WHERE recording."callId" = call."id";

UPDATE "calls" call
SET "callTranscriptId" = transcript."id"
FROM (
  SELECT DISTINCT ON ("callId") "callId", "id"
  FROM "call_transcripts"
  ORDER BY "callId", "createdAt" DESC
) transcript
WHERE transcript."callId" = call."id";

UPDATE "calls" call
SET "answeredAt" = session."connectedAt"
FROM (
  SELECT DISTINCT ON ("callId") "callId", "connectedAt"
  FROM "call_sessions"
  WHERE "connectedAt" IS NOT NULL
  ORDER BY "callId", "connectedAt" ASC
) session
WHERE session."callId" = call."id" AND call."answeredAt" IS NULL;

CREATE UNIQUE INDEX "calls_conversationId_key" ON "calls"("conversationId");
CREATE UNIQUE INDEX "calls_callRecordingId_key" ON "calls"("callRecordingId");
CREATE UNIQUE INDEX "calls_callTranscriptId_key" ON "calls"("callTranscriptId");
CREATE INDEX "calls_conversationId_idx" ON "calls"("conversationId");
CREATE INDEX "calls_callRecordingId_idx" ON "calls"("callRecordingId");
CREATE INDEX "calls_callTranscriptId_idx" ON "calls"("callTranscriptId");
CREATE INDEX "calls_source_idx" ON "calls"("source");
CREATE INDEX "calls_endReason_idx" ON "calls"("endReason");
CREATE INDEX "calls_organizationId_startedAt_idx" ON "calls"("organizationId", "startedAt");
CREATE INDEX "calls_organizationId_status_startedAt_idx" ON "calls"("organizationId", "status", "startedAt");
CREATE INDEX "calls_search_text_idx" ON "calls"
USING GIN (to_tsvector('simple', coalesce("callerNumber", '') || ' ' || coalesce("calledNumber", '') || ' ' || coalesce("twilioCallSid", '')));

ALTER TABLE "calls"
ADD CONSTRAINT "calls_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calls"
ADD CONSTRAINT "calls_callRecordingId_fkey"
FOREIGN KEY ("callRecordingId") REFERENCES "call_recordings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calls"
ADD CONSTRAINT "calls_callTranscriptId_fkey"
FOREIGN KEY ("callTranscriptId") REFERENCES "call_transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
