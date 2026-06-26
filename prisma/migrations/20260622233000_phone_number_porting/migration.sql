CREATE TYPE "PortRequestStatus" AS ENUM ('PENDING', 'DOCUMENT_REQUIRED', 'SUBMITTED', 'PROCESSING', 'REJECTED', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "PortDocumentType" AS ENUM ('PORT_LOA');

ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'PORT_REQUESTS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'COMPLETED_PORTS';
ALTER TYPE "UsageResource" ADD VALUE IF NOT EXISTS 'FAILED_PORTS';

CREATE TABLE "port_documents" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "PortDocumentType" NOT NULL DEFAULT 'PORT_LOA',
  "originalFileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "port_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "port_requests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "currentCarrier" TEXT NOT NULL,
  "encryptedAccountNumber" TEXT NOT NULL,
  "encryptedAccountPin" TEXT,
  "businessName" TEXT NOT NULL,
  "businessAddress" JSONB NOT NULL,
  "authorizedContactName" TEXT NOT NULL,
  "authorizedContactEmail" TEXT NOT NULL,
  "authorizedContactPhone" TEXT NOT NULL,
  "loaDocumentId" TEXT,
  "status" "PortRequestStatus" NOT NULL DEFAULT 'PENDING',
  "statusMessage" TEXT,
  "twilioPortRequestId" TEXT,
  "estimatedPortDate" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "assignedAgentId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "phoneNumberId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "port_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "port_request_history" (
  "id" TEXT NOT NULL,
  "portRequestId" TEXT NOT NULL,
  "status" "PortRequestStatus" NOT NULL,
  "message" TEXT,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "port_request_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "port_requests_organizationId_phoneNumber_key" ON "port_requests"("organizationId", "phoneNumber");
CREATE UNIQUE INDEX "port_requests_loaDocumentId_key" ON "port_requests"("loaDocumentId");
CREATE UNIQUE INDEX "port_requests_twilioPortRequestId_key" ON "port_requests"("twilioPortRequestId");
CREATE UNIQUE INDEX "port_requests_phoneNumberId_key" ON "port_requests"("phoneNumberId");
CREATE INDEX "port_documents_organizationId_idx" ON "port_documents"("organizationId");
CREATE INDEX "port_documents_type_idx" ON "port_documents"("type");
CREATE INDEX "port_documents_createdAt_idx" ON "port_documents"("createdAt");
CREATE INDEX "port_requests_organizationId_idx" ON "port_requests"("organizationId");
CREATE INDEX "port_requests_phoneNumber_idx" ON "port_requests"("phoneNumber");
CREATE INDEX "port_requests_status_idx" ON "port_requests"("status");
CREATE INDEX "port_requests_twilioPortRequestId_idx" ON "port_requests"("twilioPortRequestId");
CREATE INDEX "port_requests_estimatedPortDate_idx" ON "port_requests"("estimatedPortDate");
CREATE INDEX "port_request_history_portRequestId_createdAt_idx" ON "port_request_history"("portRequestId", "createdAt");

ALTER TABLE "port_documents" ADD CONSTRAINT "port_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "port_documents" ADD CONSTRAINT "port_documents_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "port_requests" ADD CONSTRAINT "port_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "port_requests" ADD CONSTRAINT "port_requests_loaDocumentId_fkey" FOREIGN KEY ("loaDocumentId") REFERENCES "port_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "port_requests" ADD CONSTRAINT "port_requests_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "port_requests" ADD CONSTRAINT "port_requests_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "port_request_history" ADD CONSTRAINT "port_request_history_portRequestId_fkey" FOREIGN KEY ("portRequestId") REFERENCES "port_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
