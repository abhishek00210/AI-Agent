-- Lead Management & Bulk Import

ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'LEAD_IMPORTS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'IMPORTED_LEADS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'CSV_UPLOADS';

ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'LEAD_UPDATED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'LEAD_DELETED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'LEAD_RESTORED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'LEAD_IMPORTED';
ALTER TYPE "CustomerTimelineEventType" ADD VALUE IF NOT EXISTS 'IMPORT_COMPLETED';

CREATE TYPE "LeadImportStatus" AS ENUM (
  'PENDING',
  'MAPPING',
  'PREVIEWED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "LeadImportDuplicateStrategy" AS ENUM (
  'SKIP',
  'UPDATE_EXISTING',
  'CREATE_NEW'
);

ALTER TABLE "leads" ADD COLUMN "deletedBy" TEXT;

CREATE TABLE "lead_imports" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdBy" TEXT,
  "fileName" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL DEFAULT 0,
  "status" "LeadImportStatus" NOT NULL DEFAULT 'PENDING',
  "mapping" JSONB NOT NULL DEFAULT '{}',
  "previewRows" JSONB NOT NULL DEFAULT '[]',
  "failedRows" JSONB NOT NULL DEFAULT '[]',
  "duplicateRows" JSONB NOT NULL DEFAULT '[]',
  "importOptions" JSONB NOT NULL DEFAULT '{}',
  "rowsFound" INTEGER NOT NULL DEFAULT 0,
  "rowsValid" INTEGER NOT NULL DEFAULT 0,
  "rowsInvalid" INTEGER NOT NULL DEFAULT 0,
  "rowsDuplicate" INTEGER NOT NULL DEFAULT 0,
  "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
  "rowsImported" INTEGER NOT NULL DEFAULT 0,
  "rowsFailed" INTEGER NOT NULL DEFAULT 0,
  "duplicates" INTEGER NOT NULL DEFAULT 0,
  "campaignId" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "lead_imports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "lead_imports"
  ADD CONSTRAINT "lead_imports_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_imports"
  ADD CONSTRAINT "lead_imports_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "lead_imports_organizationId_idx" ON "lead_imports"("organizationId");
CREATE INDEX "lead_imports_organizationId_status_createdAt_idx" ON "lead_imports"("organizationId", "status", "createdAt");
CREATE INDEX "lead_imports_campaignId_idx" ON "lead_imports"("campaignId");
