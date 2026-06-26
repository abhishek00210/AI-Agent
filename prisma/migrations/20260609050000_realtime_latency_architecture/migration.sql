CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "knowledge_embeddings"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

UPDATE "knowledge_embeddings"
SET "embedding" = "embeddingVector"::vector
WHERE cardinality("embeddingVector") = 1536;

CREATE OR REPLACE FUNCTION sync_knowledge_embedding_vector()
RETURNS trigger AS $$
BEGIN
  IF cardinality(NEW."embeddingVector") = 1536 THEN
    NEW."embedding" := NEW."embeddingVector"::vector;
  ELSE
    NEW."embedding" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_embeddings_vector_sync ON "knowledge_embeddings";

CREATE TRIGGER knowledge_embeddings_vector_sync
BEFORE INSERT OR UPDATE OF "embeddingVector" ON "knowledge_embeddings"
FOR EACH ROW EXECUTE FUNCTION sync_knowledge_embedding_vector();

CREATE INDEX IF NOT EXISTS "knowledge_embeddings_embedding_hnsw_idx"
ON "knowledge_embeddings"
USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "knowledge_embeddings_organizationId_embeddingModel_idx"
ON "knowledge_embeddings" ("organizationId", "embeddingModel");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_organizationId_knowledgeBaseId_idx"
ON "knowledge_chunks" ("organizationId", "knowledgeBaseId");

CREATE INDEX IF NOT EXISTS "call_sessions_streamSid_status_idx"
ON "call_sessions" ("streamSid", "status");

CREATE INDEX IF NOT EXISTS "realtime_sessions_organizationId_callSessionId_status_idx"
ON "realtime_sessions" ("organizationId", "callSessionId", "status");

CREATE INDEX IF NOT EXISTS "agents_organizationId_id_status_deletedAt_idx"
ON "agents" ("organizationId", "id", "status", "deletedAt");
