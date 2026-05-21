---
name: pinecone-vector-db
description: Pinecone managed vector database for production semantic search and RAG. Use this skill when picking serverless vs pod-based indexes, designing namespaces for multi-tenancy, writing metadata filters, combining sparse and dense vectors for hybrid search, or using the v3 Python/TypeScript clients (Pinecone, ServerlessSpec, PodSpec).
---

# Pinecone Vector Database

Pinecone is a fully managed vector database that handles sharding, replication, and ANN indexing as a service. It is a strong default when you do not want to operate a vector DB and need predictable low-latency similarity search at scale, with first-class metadata filtering and namespaces for tenancy.

## Use this skill when

- Choosing between serverless indexes (usage-billed, auto-scaling) and pod-based indexes (fixed capacity, predictable latency)
- Designing namespaces to isolate tenants, environments, or document sets within one index
- Writing metadata filters using `$eq`, `$ne`, `$in`, `$nin`, `$gt`, `$gte`, `$lt`, `$lte`, `$and`, `$or`
- Implementing hybrid search by combining sparse (SPLADE/BM25) and dense vectors with `alpha`
- Using the v3 clients (`pinecone-client` Python or `@pinecone-database/pinecone` TS)
- Picking similarity metric (`cosine`, `dotproduct`, `euclidean`) at index creation

## Do not use this skill when

- You need transactional joins with relational data—use [[pgvector-postgres]]
- You need full control over quantization, payload schemas, or self-hosting—use [[qdrant-vector-db]]
- Vector count and QPS are tiny; a plain in-memory FAISS index is cheaper

## Core concepts

A Pinecone *index* has a fixed dimensionality and metric, set at creation. Inside an index, vectors are partitioned into *namespaces* (logical isolation, queried one at a time). Each vector has an `id`, the values, and optional `metadata` (JSON). Serverless indexes scale and bill on usage; pod indexes have fixed `p1`/`s1`/`p2` shapes with `replicas` and `pod_type`.

## Quick start

```python
# pip install "pinecone>=5.0.0"
from pinecone import Pinecone, ServerlessSpec

pc = Pinecone(api_key="...")

pc.create_index(
    name="docs",
    dimension=1536,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)

index = pc.Index("docs")

index.upsert(
    vectors=[
        {"id": "doc-1",
         "values": [0.1] * 1536,
         "metadata": {"tenant": "acme", "lang": "en", "year": 2024}},
    ],
    namespace="prod",
)

res = index.query(
    vector=[0.1] * 1536,
    top_k=5,
    namespace="prod",
    filter={"tenant": {"$eq": "acme"}, "year": {"$gte": 2023}},
    include_metadata=True,
)
```

## Key patterns

### Serverless vs pod
- Serverless: pay per read/write/storage, auto-scales, cold-start latency on first query of an idle namespace. Default for new projects.
- Pod-based: pick `pod_type` (`p1.x1`, `p2.x1`, `s1.x1`) and `replicas`. Predictable p99 latency; required for very high QPS or strict SLAs.

### Namespaces for multi-tenancy
- One index, many namespaces (free). Queries are scoped to one namespace and cannot cross-namespace.
- Use namespaces for tenant isolation, not metadata filters—much faster and cleaner deletes (`index.delete(namespace="tenant-x", delete_all=True)`).

### Metadata filters
- Filters run as part of the ANN search, not after; selective filters are cheap.
- Supported types: string, number, boolean, list of strings. No nested objects.
- Index metadata fields you actually filter on; for pod indexes use `metadata_config={"indexed": ["tenant","lang"]}` to keep memory down.

### Hybrid (sparse + dense)
- Create an index with `metric="dotproduct"` (required for hybrid).
- Upsert `sparse_values={"indices": [...], "values": [...]}` alongside `values`.
- Query with both `vector` and `sparse_vector`; weight with `alpha` (1.0 = pure dense, 0.0 = pure sparse).

### Batching and limits
- Upsert in batches of 100 vectors or up to 2MB per request. Use the async client for parallel batches.
- `fetch` by id is much cheaper than `query` if you already know which vectors to retrieve.
- `top_k` max is 10,000 without metadata, 1,000 with metadata.

### TypeScript v3 client
```ts
import { Pinecone } from "@pinecone-database/pinecone";
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index("docs").namespace("prod");
await index.upsert([{ id: "doc-1", values: dense, metadata: { tenant: "acme" } }]);
const res = await index.query({ vector: dense, topK: 5, filter: { tenant: "acme" } });
```

## Common pitfalls

- Treating namespaces as queryable across boundaries; they are not—one query, one namespace.
- Forgetting that `dimension` and `metric` are immutable; a model change means a new index plus reindex.
- Putting large blobs in metadata (limit is 40KB per vector); store the chunk text in object storage and keep just an `s3_key` in metadata.
- Filtering on un-indexed metadata fields on pod indexes—slow and memory-heavy.
- Assuming list metadata supports `$in` element matching; `$in` works on a scalar field against a list of allowed values.
- Mixing the v2 and v3 clients in one project; v3 (`Pinecone` class, `ServerlessSpec`) is current and required for serverless.
- Expecting strong read-after-write consistency; upserts are eventually consistent (typically <10s) and may not appear in the next query.

## Reference
- Official docs: https://docs.pinecone.io
- Related: [[pgvector-postgres]], [[qdrant-vector-db]]
