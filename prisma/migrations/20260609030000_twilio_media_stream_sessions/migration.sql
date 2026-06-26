-- CreateEnum
CREATE TYPE "CallSessionStatus" AS ENUM ('CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "twilioCallSid" TEXT NOT NULL,
    "streamSid" TEXT,
    "status" "CallSessionStatus" NOT NULL DEFAULT 'CONNECTING',
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "packetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_streamSid_key" ON "call_sessions"("streamSid");

-- CreateIndex
CREATE INDEX "call_sessions_organizationId_idx" ON "call_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "call_sessions_callId_idx" ON "call_sessions"("callId");

-- CreateIndex
CREATE INDEX "call_sessions_twilioCallSid_idx" ON "call_sessions"("twilioCallSid");

-- CreateIndex
CREATE INDEX "call_sessions_streamSid_idx" ON "call_sessions"("streamSid");

-- CreateIndex
CREATE INDEX "call_sessions_status_idx" ON "call_sessions"("status");

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
