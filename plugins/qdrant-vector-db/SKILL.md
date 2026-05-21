---
name: qdrant-vector-db
description: Qdrant Rust-based vector database for self-hosted or managed semantic search. Use this skill when designing collections, payload schemas, filter conditions, choosing quantization (scalar, product, binary), running Qdrant locally via Docker, or deciding between self-hosted and Qdrant Cloud for cost/control tradeoffs.
---

# Qdrant Vector Database

Qdrant is an open-source vector DB written in Rust, with a strong story for payload filtering, on-disk storage, and quantization (scalar, product, binary). It is a good default when you want a dedicated vector DB but need self-hosting, fine-grained quantization controls, or first-class structured payload filtering alongside ANN.

## Use this skill when

- Running a self-hosted vector DB via Docker or Kubernetes, or using Qdrant Cloud
- Designing a collection with vector params (size, distance) and payload schema with payload indexes
- Writing filter conditions (`must`, `should`, `must_not`) with `match`, `range`, `geo`, `values_count`
- Picking quantization: scalar (4x), product (up to 64x), or binary (32x) and tuning `rescore`
- Using named vectors for multi-modal or multi-encoder collections
- Sharding and replicating for HA via `shard_number` and `replication_factor`

## Do not use this skill when

- You want zero ops and tight integration with relational data—use [[pgvector-postgres]]
- You want a fully managed serverless option with the simplest pricing—use [[pinecone-vector-db]]
- You only have a few thousand vectors; an in-memory store is enough

## Core concepts

A Qdrant *collection* stores points: an `id` (uint or UUID), one or more *named vectors*, and a JSON *payload*. Filtering uses indexed payload fields; without payload indexes filters fall back to a slower scan. HNSW is the only ANN index; quantization compresses vectors in memory while keeping originals on disk for optional `rescore`.

## Quick start

```bash
docker run -p 6333:6333 -p 6334:6334 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

```python
# pip install qdrant-client
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue,
    ScalarQuantization, ScalarQuantizationConfig, ScalarType,
)

client = QdrantClient(url="http://localhost:6333")

client.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    quantization_config=ScalarQuantization(
        scalar=ScalarQuantizationConfig(type=ScalarType.INT8, always_ram=True)
    ),
)

client.create_payload_index("docs", field_name="tenant", field_schema="keyword")

client.upsert("docs", points=[
    PointStruct(id=1, vector=[0.1]*1536, payload={"tenant": "acme", "lang": "en"}),
])

hits = client.query_points(
    collection_name="docs",
    query=[0.1]*1536,
    limit=5,
    query_filter=Filter(must=[FieldCondition(key="tenant", match=MatchValue(value="acme"))]),
).points
```

## Key patterns

### Filter structure
- `must`, `should`, `must_not` arrays of conditions; combine with nested `Filter` for boolean logic.
- Condition types: `MatchValue`, `MatchAny` (set membership), `Range` (gt/gte/lt/lte), `GeoBoundingBox`, `GeoRadius`, `ValuesCount`, `IsEmpty`, `IsNull`.
- Always create a `payload_index` on filter fields; without it Qdrant scans payloads.

### Quantization choices
- Scalar (`int8`): ~4x memory cut, ~1% recall loss. Good default; set `always_ram=True` to pin quantized vectors in RAM and originals on disk.
- Product: up to 64x cut, higher recall loss; tune `compression` ratio. Use for very large collections.
- Binary: 32x cut, fastest queries; pair with `rescore=True` and `oversampling=2.0` to recover recall.

### Named vectors (multi-model collections)
```python
client.create_collection(
    "products",
    vectors_config={
        "image": VectorParams(size=512, distance=Distance.COSINE),
        "text":  VectorParams(size=1536, distance=Distance.COSINE),
    },
)
# Query one named vector at a time:
client.query_points("products", using="text", query=text_vec, limit=10)
```

### Self-hosted HA
- `shard_number`: horizontal partitioning; choose at create time.
- `replication_factor`: number of replicas per shard.
- `write_consistency_factor`: how many replicas must ack a write.

### gRPC for high throughput
- Use port `6334` and `prefer_grpc=True` in the client for upserts and high-QPS queries; REST on 6333 is fine for admin and low volume.

### Snapshots and migration
- `client.create_snapshot("docs")` produces a downloadable snapshot per shard; use for backups and moving between clusters.

## Common pitfalls

- Filtering on a payload field that has no index; queries are correct but slow as the collection grows.
- Forgetting `always_ram=True` on quantization and getting unexpectedly slow queries because quantized vectors hit disk.
- Building binary quantization without `rescore=True`; recall craters.
- Mixing distance metrics across collections and then comparing scores—score scales differ per metric.
- Using string ids that are not valid UUIDs; Qdrant accepts only `uint64` or UUID-shaped strings.
- Putting huge payload blobs in the point; payload is loaded into memory for filtering. Keep payload small, store blobs elsewhere.
- Resizing vector dimension after creation; not supported—recreate the collection.

## Reference
- Official docs: https://qdrant.tech/documentation/
- Related: [[pgvector-postgres]], [[pinecone-vector-db]]
