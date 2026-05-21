---
name: mongodb
description: Design and operate MongoDB schemas, indexes, and aggregation pipelines. Use for document modeling (embed vs reference), compound/multikey/TTL/text/geospatial indexes, $match/$group/$lookup pipelines, transactions, replica sets, sharding, and change streams.
---

# MongoDB

MongoDB is a document database storing BSON documents in collections. Schema flexibility is a feature, not a license for chaos: model around access patterns first, then pick embedding vs referencing, then index the queries you actually run.

## Use this skill when

- Modeling a new collection and deciding embed vs reference
- Designing indexes for an existing query pattern (compound, multikey, TTL, text, 2dsphere)
- Writing aggregation pipelines with `$lookup`, `$group`, `$facet`, `$unwind`
- Setting up replica sets, read/write concerns, or multi-document transactions
- Planning sharding (choosing a shard key) or change streams for CDC

## Do not use this skill when

- The target is a relational database (use the SQL skill)
- You only need a key-value cache (use Redis)
- You need full ACID multi-row joins as a primary access pattern

## Core concepts

A document is a BSON object up to 16 MB. Collections live in databases. Indexes are B-tree on BSON paths; queries that lack a usable index scan the collection. Reads default to the primary in a replica set; writes always go to the primary.

## Quick start

```javascript
// Create a collection with schema validation
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "status", "total", "createdAt"],
      properties: {
        userId: { bsonType: "objectId" },
        status: { enum: ["PENDING", "PAID", "CANCELED"] },
        total: { bsonType: "decimal" },
        createdAt: { bsonType: "date" }
      }
    }
  }
});

db.orders.createIndex({ userId: 1, createdAt: -1 });
db.orders.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
```

## Key patterns

- Embed when child data is bounded, read together, and updated together (e.g., line items inside an order). Reference when the child is large, unbounded, or shared across parents (e.g., user referenced by many orders).
- Compound index field order: equality first, then sort, then range (the ESR rule). `{ tenantId: 1, createdAt: -1 }` serves `find({tenantId: x}).sort({createdAt: -1})` efficiently.
- Multikey indexes are created automatically when an indexed field is an array. You cannot create a compound index across two array fields.
- TTL indexes must be on a `Date` field. `expireAfterSeconds: 0` with a future date acts as a scheduled deletion.
- Aggregation: put `$match` and `$project` as early as possible so the planner can use indexes and reduce documents before `$group`/`$lookup`.
- Use `$lookup` with `localField`/`foreignField` for simple joins; use the pipeline form (`let` + `pipeline`) for filtered or correlated joins.
- Transactions span multiple documents/collections but require a replica set or sharded cluster. Keep them short (sub-second) and retryable.
- Change streams (`db.coll.watch()`) expose an oplog-backed event stream. Use `resumeToken` to continue after disconnects.
- Shard key choice is permanent and load-bearing: pick a high-cardinality, low-frequency, monotonically-non-increasing key, or a hashed key for write distribution.

## Common pitfalls

- Unbounded arrays inside a document. Once the document approaches 16 MB or arrays cross a few thousand entries, indexes balloon and updates rewrite the whole document.
- Indexing every field "just in case". Each index slows writes and consumes RAM; missing the right compound is worse than missing several single-field indexes.
- Sorting without a usable index. MongoDB will perform an in-memory sort and abort at 100 MB unless `allowDiskUse: true` is set on aggregations.
- Using a monotonically increasing shard key (like `ObjectId` or timestamp) and getting a single hot shard for all inserts.
- Assuming transactions are free. They acquire locks on every touched document and abort under write conflicts; design around single-document atomicity first.
- Treating secondary reads as consistent. Default read preference is `primary`; switching to `secondary` gives you eventually consistent, potentially stale data.
- `$lookup` against an unindexed `foreignField` is an O(N*M) nested loop. Always index the foreign side.

## Read and write concerns

- Write concern: `w: "majority"` waits for acknowledgment from a majority of replica set members. Use it for anything you cannot lose. `w: 1` is the default and only confirms the primary.
- Read concern: `local` (default) reads whatever the primary has; `majority` reads only data acknowledged by a majority (no rollbacks); `linearizable` is strongest but slowest.
- `j: true` waits for the on-disk journal to flush. Combine with `w: "majority"` for the strongest durability.
- Causal consistency: pass `causalConsistency: true` on the session so a client sees its own writes even when reading from a secondary.

## Reference

- Official docs: https://www.mongodb.com/docs/manual/
- Aggregation pipeline operators: https://www.mongodb.com/docs/manual/reference/operator/aggregation/
- Index types: https://www.mongodb.com/docs/manual/indexes/
- Read/write concerns: https://www.mongodb.com/docs/manual/reference/read-concern/
