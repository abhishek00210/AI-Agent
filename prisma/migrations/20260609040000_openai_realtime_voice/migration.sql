-- CreateEnum
CREATE TYPE "RealtimeSessionStatus" AS ENUM ('CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateTable
CREATE TABLE "realtime_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "openAiSessionId" TEXT,
    "status" "RealtimeSessionStatus" NOT NULL DEFAULT 'CONNECTING',
    "audioPacketsSent" INTEGER NOT NULL DEFAULT 0,
    "audioPacketsReceived" INTEGER NOT NULL DEFAULT 0,
    "lastLatencyMs" INTEGER,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realtime_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "realtime_sessions_callSessionId_key" ON "realtime_sessions"("callSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "realtime_sessions_conversationId_key" ON "realtime_sessions"("conversationId");

-- CreateIndex
CREATE INDEX "realtime_sessions_organizationId_idx" ON "realtime_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "realtime_sessions_callId_idx" ON "realtime_sessions"("callId");

-- CreateIndex
CREATE INDEX "realtime_sessions_agentId_idx" ON "realtime_sessions"("agentId");

-- CreateIndex
CREATE INDEX "realtime_sessions_openAiSessionId_idx" ON "realtime_sessions"("openAiSessionId");

-- CreateIndex
CREATE INDEX "realtime_sessions_status_idx" ON "realtime_sessions"("status");

-- CreateIndex
CREATE INDEX "realtime_sessions_createdAt_idx" ON "realtime_sessions"("createdAt");

-- AddForeignKey
ALTER TABLE "realtime_sessions" ADD CONSTRAINT "realtime_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_sessions" ADD CONSTRAINT "realtime_sessions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_sessions" ADD CONSTRAINT "realtime_sessions_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_sessions" ADD CONSTRAINT "realtime_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realtime_sessions" ADD CONSTRAINT "realtime_sessions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
