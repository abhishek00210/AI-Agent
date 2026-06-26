CREATE TYPE "FaqStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "faq_entries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "status" "FaqStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rag_search_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT,
  "agentId" TEXT,
  "query" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "resultCount" INTEGER NOT NULL,
  "averageScore" DOUBLE PRECISION NOT NULL,
  "responseTimeMs" INTEGER NOT NULL,
  "failed" BOOLEAN NOT NULL DEFAULT false,
  "usedDocumentChunks" INTEGER NOT NULL DEFAULT 0,
  "usedWebsiteChunks" INTEGER NOT NULL DEFAULT 0,
  "usedFaqChunks" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rag_search_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "knowledge_chunks" ADD COLUMN "faqEntryId" TEXT;

CREATE UNIQUE INDEX "knowledge_chunks_faqEntryId_chunkIndex_key"
  ON "knowledge_chunks"("faqEntryId", "chunkIndex");
CREATE INDEX "knowledge_chunks_faqEntryId_idx" ON "knowledge_chunks"("faqEntryId");

CREATE INDEX "faq_entries_organizationId_idx" ON "faq_entries"("organizationId");
CREATE INDEX "faq_entries_knowledgeBaseId_idx" ON "faq_entries"("knowledgeBaseId");
CREATE INDEX "faq_entries_status_idx" ON "faq_entries"("status");
CREATE INDEX "faq_entries_createdAt_idx" ON "faq_entries"("createdAt");
CREATE INDEX "faq_entries_deletedAt_idx" ON "faq_entries"("deletedAt");

CREATE INDEX "rag_search_events_organizationId_idx" ON "rag_search_events"("organizationId");
CREATE INDEX "rag_search_events_knowledgeBaseId_idx" ON "rag_search_events"("knowledgeBaseId");
CREATE INDEX "rag_search_events_agentId_idx" ON "rag_search_events"("agentId");
CREATE INDEX "rag_search_events_source_idx" ON "rag_search_events"("source");
CREATE INDEX "rag_search_events_failed_idx" ON "rag_search_events"("failed");
CREATE INDEX "rag_search_events_createdAt_idx" ON "rag_search_events"("createdAt");

ALTER TABLE "faq_entries"
  ADD CONSTRAINT "faq_entries_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "faq_entries"
  ADD CONSTRAINT "faq_entries_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_faqEntryId_fkey"
  FOREIGN KEY ("faqEntryId") REFERENCES "faq_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rag_search_events"
  ADD CONSTRAINT "rag_search_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rag_search_events"
  ADD CONSTRAINT "rag_search_events_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rag_search_events"
  ADD CONSTRAINT "rag_search_events_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "agents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks" DROP CONSTRAINT "knowledge_chunks_single_source_chk";
ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_single_source_chk" CHECK (
    (
      "documentId" IS NOT NULL
      AND "websiteSourceId" IS NULL
      AND "faqEntryId" IS NULL
    )
    OR (
      "documentId" IS NULL
      AND "websiteSourceId" IS NOT NULL
      AND "faqEntryId" IS NULL
    )
    OR (
      "documentId" IS NULL
      AND "websiteSourceId" IS NULL
      AND "faqEntryId" IS NOT NULL
    )
  );
