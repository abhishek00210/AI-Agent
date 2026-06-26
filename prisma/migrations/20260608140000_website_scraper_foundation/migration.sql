CREATE TYPE "WebsiteSourceStatus" AS ENUM ('PENDING', 'SCRAPING', 'COMPLETED', 'FAILED');

CREATE TABLE "website_sources" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" "WebsiteSourceStatus" NOT NULL DEFAULT 'PENDING',
    "contentLength" INTEGER NOT NULL DEFAULT 0,
    "lastScrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "website_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "website_content" (
    "id" TEXT NOT NULL,
    "websiteSourceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_content_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "website_content_websiteSourceId_key" ON "website_content"("websiteSourceId");

CREATE INDEX "website_sources_organizationId_idx" ON "website_sources"("organizationId");
CREATE INDEX "website_sources_knowledgeBaseId_idx" ON "website_sources"("knowledgeBaseId");
CREATE INDEX "website_sources_status_idx" ON "website_sources"("status");
CREATE INDEX "website_sources_createdAt_idx" ON "website_sources"("createdAt");
CREATE INDEX "website_sources_lastScrapedAt_idx" ON "website_sources"("lastScrapedAt");
CREATE INDEX "website_sources_deletedAt_idx" ON "website_sources"("deletedAt");

CREATE INDEX "website_content_organizationId_idx" ON "website_content"("organizationId");
CREATE INDEX "website_content_wordCount_idx" ON "website_content"("wordCount");

ALTER TABLE "website_sources"
ADD CONSTRAINT "website_sources_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_sources"
ADD CONSTRAINT "website_sources_knowledgeBaseId_fkey"
FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_content"
ADD CONSTRAINT "website_content_websiteSourceId_fkey"
FOREIGN KEY ("websiteSourceId") REFERENCES "website_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_content"
ADD CONSTRAINT "website_content_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
