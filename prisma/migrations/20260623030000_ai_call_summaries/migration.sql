CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
CREATE TYPE "Outcome" AS ENUM ('BOOKED_APPOINTMENT', 'QUALIFIED_LEAD', 'FOLLOW_UP_REQUIRED', 'INFORMATION_PROVIDED', 'TRANSFERRED', 'UNRESOLVED', 'OTHER');

ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AI_SUMMARY_GENERATIONS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AI_SUMMARY_INPUT_TOKENS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AI_SUMMARY_OUTPUT_TOKENS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'AI_SUMMARY_COST_MICROS';

CREATE TABLE "call_summaries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "callId" TEXT NOT NULL,
  "conversationId" TEXT,
  "transcriptId" TEXT,
  "summary" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "sentiment" "Sentiment" NOT NULL,
  "outcome" "Outcome" NOT NULL,
  "nextAction" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "summaryVersion" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_summaries_callId_key" ON "call_summaries"("callId");
CREATE INDEX "call_summaries_organizationId_idx" ON "call_summaries"("organizationId");
CREATE INDEX "call_summaries_customerProfileId_idx" ON "call_summaries"("customerProfileId");
CREATE INDEX "call_summaries_callId_idx" ON "call_summaries"("callId");
CREATE INDEX "call_summaries_generatedAt_idx" ON "call_summaries"("generatedAt");
CREATE INDEX "call_summaries_intent_idx" ON "call_summaries"("intent");
CREATE INDEX "call_summaries_sentiment_idx" ON "call_summaries"("sentiment");

ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "call_transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
