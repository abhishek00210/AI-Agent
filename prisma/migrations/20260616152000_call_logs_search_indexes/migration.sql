CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "calls_organizationId_startedAt_id_idx"
ON "calls"("organizationId", "startedAt", "id");

CREATE INDEX IF NOT EXISTS "calls_callerNumber_trgm_idx"
ON "calls" USING GIN ("callerNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "calls_calledNumber_trgm_idx"
ON "calls" USING GIN ("calledNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "calls_twilioCallSid_trgm_idx"
ON "calls" USING GIN ("twilioCallSid" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "agents_name_trgm_idx"
ON "agents" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "call_transcripts_search_text_idx"
ON "call_transcripts"
USING GIN (to_tsvector('simple', coalesce("fullText", '') || ' ' || coalesce("summary", '')));

CREATE INDEX IF NOT EXISTS "call_transcripts_organizationId_callId_idx"
ON "call_transcripts"("organizationId", "callId");
