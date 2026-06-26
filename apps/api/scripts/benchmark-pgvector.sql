\set ON_ERROR_STOP on

CREATE TEMP TABLE benchmark_vectors (
  id bigint PRIMARY KEY,
  organization_id uuid NOT NULL,
  knowledge_base_id uuid NOT NULL,
  embedding vector(1536) NOT NULL
);

INSERT INTO benchmark_vectors (id, organization_id, knowledge_base_id, embedding)
SELECT
  value,
  CASE
    WHEN value % 2 = 0 THEN '00000000-0000-0000-0000-000000000001'::uuid
    ELSE '00000000-0000-0000-0000-000000000002'::uuid
  END,
  CASE
    WHEN value % 4 < 2 THEN '00000000-0000-0000-0000-000000000011'::uuid
    ELSE '00000000-0000-0000-0000-000000000012'::uuid
  END,
  array_fill(((value % 100)::double precision / 100), ARRAY[1536])::vector
FROM generate_series(1, 10000) AS value;

CREATE INDEX benchmark_vectors_hnsw_idx
ON benchmark_vectors USING hnsw (embedding vector_cosine_ops);

CREATE INDEX benchmark_vectors_tenant_idx
ON benchmark_vectors (organization_id, knowledge_base_id);

ANALYZE benchmark_vectors;
SET hnsw.iterative_scan = strict_order;

EXPLAIN (ANALYZE, BUFFERS)
WITH nearest AS MATERIALIZED (
  SELECT
    id,
    embedding <=> array_fill(0.42::double precision, ARRAY[1536])::vector AS distance
  FROM benchmark_vectors
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND knowledge_base_id = '00000000-0000-0000-0000-000000000011'::uuid
  ORDER BY embedding <=> array_fill(0.42::double precision, ARRAY[1536])::vector
  LIMIT 50
)
SELECT id, 1 - distance AS score
FROM nearest
ORDER BY distance, id
LIMIT 5;

EXPLAIN (ANALYZE, BUFFERS)
WITH nearest AS MATERIALIZED (
  SELECT
    id,
    embedding <=> array_fill(0.42::double precision, ARRAY[1536])::vector AS distance
  FROM benchmark_vectors
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND knowledge_base_id = '00000000-0000-0000-0000-000000000011'::uuid
  ORDER BY embedding <=> array_fill(0.42::double precision, ARRAY[1536])::vector
  LIMIT 50
)
SELECT id, 1 - distance AS score
FROM nearest
ORDER BY distance, id
LIMIT 5;
