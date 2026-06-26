CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "SpeakerType" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'UNKNOWN');

CREATE TABLE "call_transcripts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "callRecordingId" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "language" TEXT,
    "provider" TEXT,
    "durationSeconds" INTEGER,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION,
    "fullText" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "failureReason" TEXT,
    "processingTimeMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_transcripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_transcript_segments" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "speaker" "SpeakerType" NOT NULL DEFAULT 'UNKNOWN',
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_transcript_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_transcripts_callRecordingId_key" ON "call_transcripts"("callRecordingId");
CREATE INDEX "call_transcripts_organizationId_idx" ON "call_transcripts"("organizationId");
CREATE INDEX "call_transcripts_callId_idx" ON "call_transcripts"("callId");
CREATE INDEX "call_transcripts_conversationId_idx" ON "call_transcripts"("conversationId");
CREATE INDEX "call_transcripts_status_idx" ON "call_transcripts"("status");
CREATE INDEX "call_transcripts_createdAt_idx" ON "call_transcripts"("createdAt");
CREATE INDEX "call_transcripts_organizationId_status_createdAt_idx" ON "call_transcripts"("organizationId", "status", "createdAt");
CREATE INDEX "call_transcripts_full_text_idx" ON "call_transcripts"
USING GIN (to_tsvector('simple', coalesce("fullText", '') || ' ' || coalesce("summary", '')));

CREATE UNIQUE INDEX "call_transcript_segments_transcriptId_sequence_key" ON "call_transcript_segments"("transcriptId", "sequence");
CREATE INDEX "call_transcript_segments_transcriptId_idx" ON "call_transcript_segments"("transcriptId");
CREATE INDEX "call_transcript_segments_speaker_idx" ON "call_transcript_segments"("speaker");
CREATE INDEX "call_transcript_segments_sequence_idx" ON "call_transcript_segments"("sequence");

ALTER TABLE "call_transcripts"
ADD CONSTRAINT "call_transcripts_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_transcripts"
ADD CONSTRAINT "call_transcripts_callId_fkey"
FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_transcripts"
ADD CONSTRAINT "call_transcripts_callRecordingId_fkey"
FOREIGN KEY ("callRecordingId") REFERENCES "call_recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_transcripts"
ADD CONSTRAINT "call_transcripts_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "call_transcript_segments"
ADD CONSTRAINT "call_transcript_segments_transcriptId_fkey"
FOREIGN KEY ("transcriptId") REFERENCES "call_transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
