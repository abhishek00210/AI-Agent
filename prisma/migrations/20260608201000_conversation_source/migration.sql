CREATE TYPE "ConversationSource" AS ENUM ('INTERNAL', 'WIDGET');

ALTER TABLE "conversations" ADD COLUMN "source" "ConversationSource" NOT NULL DEFAULT 'INTERNAL';

CREATE INDEX "conversations_source_idx" ON "conversations"("source");
