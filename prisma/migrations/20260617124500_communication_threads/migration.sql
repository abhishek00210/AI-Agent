CREATE TYPE "CommunicationChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP', 'WEB_CHAT', 'VOICE');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "communication_threads" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "lastDirection" "CommunicationDirection",
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "communication_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_threads_organizationId_contactId_channel_key"
  ON "communication_threads"("organizationId", "contactId", "channel");

CREATE INDEX "communication_threads_organizationId_idx"
  ON "communication_threads"("organizationId");

CREATE INDEX "communication_threads_contactId_idx"
  ON "communication_threads"("contactId");

CREATE INDEX "communication_threads_organizationId_channel_lastMessageAt_idx"
  ON "communication_threads"("organizationId", "channel", "lastMessageAt");

CREATE INDEX "communication_threads_organizationId_unreadCount_idx"
  ON "communication_threads"("organizationId", "unreadCount");

ALTER TABLE "communication_threads"
  ADD CONSTRAINT "communication_threads_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication_threads"
  ADD CONSTRAINT "communication_threads_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
