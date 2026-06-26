-- Extend document processing lifecycle for embedding generation.
ALTER TYPE "ProcessingStatus" ADD VALUE IF NOT EXISTS 'EMBEDDING';

-- Store normalized source chunks before vector generation.
CREATE TABLE "knowledge_chunks" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "documentId" TEXT,
  "websiteSourceId" TEXT,
  "chunkIndex" INTEGER NOT NULL,
  "chunkText" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_chunks_single_source_chk" CHECK (
    (
      "documentId" IS NOT NULL
      AND "websiteSourceId" IS NULL
    )
    OR (
      "documentId" IS NULL
      AND "websiteSourceId" IS NOT NULL
    )
  )
);

-- Store one embedding per chunk. Float arrays keep Day 11 provider-agnostic
-- while later phases can add pgvector/vector indexes without changing contracts.
CREATE TABLE "knowledge_embeddings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "chunkId" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingVector" DOUBLE PRECISION[] NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "knowledge_chunks_documentId_chunkIndex_key"
  ON "knowledge_chunks"("documentId", "chunkIndex");
CREATE UNIQUE INDEX "knowledge_chunks_websiteSourceId_chunkIndex_key"
  ON "knowledge_chunks"("websiteSourceId", "chunkIndex");
CREATE INDEX "knowledge_chunks_organizationId_idx" ON "knowledge_chunks"("organizationId");
CREATE INDEX "knowledge_chunks_knowledgeBaseId_idx" ON "knowledge_chunks"("knowledgeBaseId");
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");
CREATE INDEX "knowledge_chunks_websiteSourceId_idx" ON "knowledge_chunks"("websiteSourceId");
CREATE INDEX "knowledge_chunks_chunkIndex_idx" ON "knowledge_chunks"("chunkIndex");
CREATE INDEX "knowledge_chunks_createdAt_idx" ON "knowledge_chunks"("createdAt");

CREATE UNIQUE INDEX "knowledge_embeddings_chunkId_key" ON "knowledge_embeddings"("chunkId");
CREATE INDEX "knowledge_embeddings_organizationId_idx" ON "knowledge_embeddings"("organizationId");
CREATE INDEX "knowledge_embeddings_embeddingModel_idx" ON "knowledge_embeddings"("embeddingModel");
CREATE INDEX "knowledge_embeddings_dimensions_idx" ON "knowledge_embeddings"("dimensions");
CREATE INDEX "knowledge_embeddings_createdAt_idx" ON "knowledge_embeddings"("createdAt");

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_websiteSourceId_fkey"
  FOREIGN KEY ("websiteSourceId") REFERENCES "website_sources"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_embeddings"
  ADD CONSTRAINT "knowledge_embeddings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_embeddings"
  ADD CONSTRAINT "knowledge_embeddings_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "knowledge_chunks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
