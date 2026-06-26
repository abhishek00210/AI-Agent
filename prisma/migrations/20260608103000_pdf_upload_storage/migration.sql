ALTER TABLE "documents"
ADD COLUMN "originalFileName" TEXT,
ADD COLUMN "fileExtension" TEXT,
ADD COLUMN "storageProvider" TEXT,
ADD COLUMN "storageBucket" TEXT,
ADD COLUMN "uploadedBy" TEXT;

CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");
CREATE INDEX "documents_uploadedBy_idx" ON "documents"("uploadedBy");

ALTER TABLE "documents"
ADD CONSTRAINT "documents_uploadedBy_fkey"
FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
