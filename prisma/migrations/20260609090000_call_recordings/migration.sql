-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('PENDING', 'RECORDING', 'PROCESSING', 'AVAILABLE', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "call_recordings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "twilioCallSid" TEXT NOT NULL,
    "storageProvider" TEXT,
    "storagePath" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/wav',
    "durationSeconds" INTEGER,
    "fileSizeBytes" INTEGER,
    "status" "RecordingStatus" NOT NULL DEFAULT 'PENDING',
    "recordingStartedAt" TIMESTAMP(3),
    "recordingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_recordings_callSessionId_key" ON "call_recordings"("callSessionId");

-- CreateIndex
CREATE INDEX "call_recordings_organizationId_idx" ON "call_recordings"("organizationId");

-- CreateIndex
CREATE INDEX "call_recordings_callId_idx" ON "call_recordings"("callId");

-- CreateIndex
CREATE INDEX "call_recordings_callSessionId_idx" ON "call_recordings"("callSessionId");

-- CreateIndex
CREATE INDEX "call_recordings_twilioCallSid_idx" ON "call_recordings"("twilioCallSid");

-- CreateIndex
CREATE INDEX "call_recordings_status_idx" ON "call_recordings"("status");

-- CreateIndex
CREATE INDEX "call_recordings_createdAt_idx" ON "call_recordings"("createdAt");

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
