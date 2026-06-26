CREATE TYPE "CommunicationProvider" AS ENUM ('TWILIO');
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE "communication_messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "provider" "CommunicationProvider" NOT NULL,
    "providerMessageId" TEXT,
    "direction" "CommunicationDirection" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "body" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "communication_messages_organizationId_idx" ON "communication_messages"("organizationId");
CREATE INDEX "communication_messages_threadId_idx" ON "communication_messages"("threadId");
CREATE INDEX "communication_messages_providerMessageId_idx" ON "communication_messages"("providerMessageId");
CREATE INDEX "communication_messages_status_idx" ON "communication_messages"("status");
CREATE INDEX "communication_messages_queuedAt_idx" ON "communication_messages"("queuedAt");
CREATE INDEX "communication_messages_organizationId_status_queuedAt_idx" ON "communication_messages"("organizationId", "status", "queuedAt");

ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
