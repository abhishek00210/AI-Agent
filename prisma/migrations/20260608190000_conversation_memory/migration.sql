-- CreateEnum
CREATE TYPE "MemoryFactType" AS ENUM ('USER_INFO', 'BUSINESS_INFO', 'APPOINTMENT', 'CONTACT', 'PREFERENCE', 'CUSTOM');

-- CreateTable
CREATE TABLE "conversation_memories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_facts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "factType" "MemoryFactType" NOT NULL DEFAULT 'CUSTOM',
    "factKey" TEXT NOT NULL,
    "factValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_memories_organizationId_idx" ON "conversation_memories"("organizationId");

-- CreateIndex
CREATE INDEX "conversation_memories_conversationId_idx" ON "conversation_memories"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_memories_messageCount_idx" ON "conversation_memories"("messageCount");

-- CreateIndex
CREATE INDEX "conversation_memories_generatedAt_idx" ON "conversation_memories"("generatedAt");

-- CreateIndex
CREATE INDEX "memory_facts_organizationId_idx" ON "memory_facts"("organizationId");

-- CreateIndex
CREATE INDEX "memory_facts_conversationId_idx" ON "memory_facts"("conversationId");

-- CreateIndex
CREATE INDEX "memory_facts_factType_idx" ON "memory_facts"("factType");

-- CreateIndex
CREATE INDEX "memory_facts_factKey_idx" ON "memory_facts"("factKey");

-- CreateIndex
CREATE INDEX "memory_facts_createdAt_idx" ON "memory_facts"("createdAt");

-- AddForeignKey
ALTER TABLE "conversation_memories" ADD CONSTRAINT "conversation_memories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_memories" ADD CONSTRAINT "conversation_memories_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
