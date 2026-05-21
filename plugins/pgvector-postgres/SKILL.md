---
name: pgvector-postgres
description: pgvector extension for storing and searching vector embeddings in PostgreSQL. Use this skill when adding semantic search to a Postgres database, building RAG over existing relational data, choosing between HNSW and IVFFlat indexes, or combining vector similarity with metadata filters and full-text search (tsvector).
---

# pgvector for PostgreSQL

pgvector adds a first-class `vector` type, distance operators, and approximate-nearest-neighbor indexes (HNSW, IVFFlat) to PostgreSQL. It is the right default when embeddings live alongside relational rows and you want a single transactional store rather than a separate vector database.

## Use this skill when

- Adding semantic search or RAG to an existing PostgreSQL app
- Choosing between HNSW (recall, fast queries, slow build) and IVFFlat (fast build, needs training data)
- Combining vector similarity with SQL `WHERE` filters, joins, and `tsvector` full-text search
- Picking a distance: cosine (`<=>`), L2 (`<->`), inner product (`<#>`)
- Tuning `hnsw.ef_search`, `ivfflat.probes`, or `maintenance_work_mem` for index builds
- Using halfvec, bit, or sparsevec to cut storage and memory

## Do not use this skill when

- You need >100M vectors with sub-10ms p99 at high QPS, beyond what a single Postgres node serves (consider Pinecone, Qdrant, Milvus)
- The system already standardizes on a dedicated vector DB and you do not need relational joins
- You only need keyword search; plain `tsvector` is enough

## Core concepts

pgvector stores fixed-dimension float32 vectors as a `vector(d)` type. Similarity is expressed via operators that map to a distance function; ANN indexes accelerate those operators but only when the query uses the matching operator family (cosine ops, L2 ops, IP ops). HNSW builds a navigable graph (good recall, no training); IVFFlat partitions vectors into lists (needs representative data when building).

## Quick start

```sql
-- Install once per database
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  doc_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content    TEXT NOT NULL,
  embedding  vector(1536) NOT NULL,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW index for cosine similarity (recommended default)
CREATE INDEX documents_embedding_hnsw
  ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX documents_tsv_gin ON documents USING GIN (tsv);

-- Top-5 nearest neighbors by cosine distance
SELECT doc_id, content, embedding <=> $1 AS distance
FROM documents
ORDER BY embedding <=> $1
LIMIT 5;
```

## Key patterns

### Pick the right operator and opclass
- Cosine distance: `<=>` with `vector_cosine_ops`
- L2 (Euclidean) distance: `<->` with `vector_l2_ops`
- Negative inner product: `<#>` with `vector_ip_ops` (multiply by -1 for similarity)
- The query operator MUST match the index opclass or the planner will do a seq scan.

### HNSW vs IVFFlat
- HNSW: build once with `m` (graph degree, default 16) and `ef_construction` (default 64). Query-time recall is controlled by `SET hnsw.ef_search = 100;`. No training data needed; works on empty tables.
- IVFFlat: `WITH (lists = sqrt(N))` rough heuristic; build AFTER loading representative data. Query recall via `SET ivfflat.probes = 10;`. Faster build, lower memory, lower recall than HNSW.

### Filtered ANN (the hard case)
- Pre-filter with a partial index when the filter is selective and known:
  `CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops) WHERE tenant_id = 42;`
- For multi-tenant or many filters, increase `hnsw.ef_search` (e.g. 200) so post-filtering still returns enough results.
- Avoid `LIMIT k` followed by `WHERE` that throws away most rows; either raise `ef_search` or use a partial index.

### Hybrid search (vector + BM25-ish)
```sql
WITH vec AS (
  SELECT doc_id, 1 - (embedding <=> $1) AS vscore
  FROM documents ORDER BY embedding <=> $1 LIMIT 50
), kw AS (
  SELECT doc_id, ts_rank_cd(tsv, plainto_tsquery('english', $2)) AS kscore
  FROM documents WHERE tsv @@ plainto_tsquery('english', $2) LIMIT 50
)
SELECT d.doc_id, d.content,
       COALESCE(vec.vscore,0)*0.7 + COALESCE(kw.kscore,0)*0.3 AS score
FROM documents d
LEFT JOIN vec USING (doc_id)
LEFT JOIN kw  USING (doc_id)
WHERE vec.doc_id IS NOT NULL OR kw.doc_id IS NOT NULL
ORDER BY score DESC LIMIT 10;
```

### Smaller, cheaper vectors
- `halfvec(d)` halves storage (fp16) and is supported by HNSW/IVFFlat.
- `bit(d)` with `bit_hamming_ops` for binary embeddings.
- `sparsevec(d)` for SPLADE-style sparse vectors.

### Faster builds
- `SET maintenance_work_mem = '4GB';` before `CREATE INDEX` for HNSW.
- `SET max_parallel_maintenance_workers = 7;` enables parallel HNSW build (pgvector 0.6+).
- Build the index AFTER bulk load, not before.

## Common pitfalls

- Using `ORDER BY embedding <-> $1` against an index built with `vector_cosine_ops` triggers a seq scan; match operator and opclass.
- Forgetting `SET hnsw.ef_search`/`ivfflat.probes` per session and getting poor recall with the defaults.
- Storing vectors as `JSONB` arrays "to be safe"; they cannot be ANN-indexed. Use the `vector` type.
- Dimension mismatch errors at insert because the column is `vector(768)` and the model emits 1536.
- Building IVFFlat on an empty or unrepresentative table—the centroids are garbage and recall collapses.
- Using `pgvector` distance in a `LIMIT k` then filtering: the filter happens after ANN, so you can get fewer than `k` results. Raise the candidate set or use a partial index.
- Confusing inner product (`<#>` returns NEGATIVE inner product so smaller = more similar) with cosine.

## Reference
- Official docs: https://github.com/pgvector/pgvector
- Related: [[postgresql]], [[pinecone-vector-db]], [[qdrant-vector-db]]
