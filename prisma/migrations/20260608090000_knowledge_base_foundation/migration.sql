CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "storagePath" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_bases_organizationId_idx" ON "knowledge_bases"("organizationId");
CREATE INDEX "knowledge_bases_agentId_idx" ON "knowledge_bases"("agentId");
CREATE INDEX "knowledge_bases_status_idx" ON "knowledge_bases"("status");
CREATE INDEX "knowledge_bases_deletedAt_idx" ON "knowledge_bases"("deletedAt");

CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");
CREATE INDEX "documents_knowledgeBaseId_idx" ON "documents"("knowledgeBaseId");
CREATE INDEX "documents_uploadStatus_idx" ON "documents"("uploadStatus");
CREATE INDEX "documents_processingStatus_idx" ON "documents"("processingStatus");
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

ALTER TABLE "knowledge_bases"
ADD CONSTRAINT "knowledge_bases_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_bases"
ADD CONSTRAINT "knowledge_bases_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"
ADD CONSTRAINT "documents_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"
ADD CONSTRAINT "documents_knowledgeBaseId_fkey"
FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
