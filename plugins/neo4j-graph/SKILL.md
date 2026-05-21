---
name: neo4j-graph
description: Model and query graph data with Neo4j. Covers nodes/relationships/properties, the Cypher query language (MATCH/WHERE/CREATE/MERGE), constraints and indexes, the official Bolt drivers, APOC procedures, graph data modeling, and common patterns like variable-length paths and shortest path.
---

# Neo4j

Neo4j is a native graph database where relationships are first-class storage primitives, not joins. Traversals are O(degree), not O(rows). Cypher is the declarative query language; ASCII-art patterns like `(a)-[:KNOWS]->(b)` are the core of every query.

## Use this skill when

- Modeling domains where relationships are the primary thing you query: social graphs, fraud rings, knowledge graphs, dependency networks, supply chains
- Writing Cypher queries with `MATCH`, `WHERE`, `CREATE`, `MERGE`, `WITH`, `RETURN`
- Adding uniqueness constraints, existence constraints, or indexes (range, text, point, vector)
- Connecting from an app via the Bolt driver (`neo4j-driver` for JS, `neo4j` for Python, etc.)
- Using APOC procedures for batch ops, JSON I/O, dynamic Cypher, or graph algorithms
- Designing traversals: variable-length `[:REL*1..5]`, shortest path, weighted shortest path via GDS

## Do not use this skill when

- Your workload is tabular aggregation with no real relationships to follow
- You need a key-value cache or document store
- Total graph size and write rate exceed what a single primary plus read replicas can serve and you have not evaluated Aura/Enterprise clustering

## Core concepts

A graph is a set of **nodes** with labels (`:Person`, `:Order`) and properties, connected by directed, typed **relationships** (`[:PURCHASED]`) that also carry properties. Cypher matches subgraph patterns; the planner uses indexes only to find anchor nodes, then traverses relationships natively without index lookups.

## Quick start

```cypher
// Constraints and indexes (do these first)
CREATE CONSTRAINT user_email_unique IF NOT EXISTS
  FOR (u:User) REQUIRE u.email IS UNIQUE;

CREATE INDEX order_created IF NOT EXISTS
  FOR (o:Order) ON (o.createdAt);

// Idempotent write with MERGE
MERGE (u:User {email: $email})
  ON CREATE SET u.createdAt = datetime()
MERGE (o:Order {id: $orderId})
  ON CREATE SET o.total = $total, o.createdAt = datetime()
MERGE (u)-[:PLACED]->(o);

// Read: friends-of-friends who bought the same product
MATCH (me:User {email: $email})-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
MATCH (other:User)-[:PLACED]->(:Order)-[:CONTAINS]->(p)
WHERE other <> me
RETURN other.email, count(DISTINCT p) AS shared
ORDER BY shared DESC LIMIT 10;
```

## Key patterns

- Always create a uniqueness constraint on the property you use as the natural key before doing `MERGE`. Without it, concurrent `MERGE` calls can create duplicates and the merge becomes a slow scan.
- `MERGE` is "match-or-create" on a full pattern. `MERGE (a)-[:R]->(b)` will create both nodes and the relationship if any part is missing. To merge a relationship between existing nodes, match the nodes first, then `MERGE` only the relationship.
- Direction matters in storage but not always in queries. Use `()-[:R]-()` (undirected) in `MATCH` when direction is irrelevant; keep direction explicit in `CREATE`/`MERGE`.
- Variable-length paths: `MATCH p = (a)-[:KNOWS*1..4]->(b)` finds paths of length 1 to 4. Always bound the upper limit; unbounded `*` can explode.
- Shortest path: `MATCH p = shortestPath((a)-[:KNOWS*..6]-(b)) RETURN p`. For weighted shortest path, use GDS (`gds.shortestPath.dijkstra.stream`).
- Use `WITH` to pipe results between query parts: aggregate, filter, then continue. It is the Cypher equivalent of subqueries.
- Parameterize everything (`$email`, not `'user@example.com'`). The driver and the planner both cache by parameterized query.
- Use `PROFILE` (executes and shows real counts) or `EXPLAIN` (plan only) to verify a query starts from an indexed anchor. Look for `NodeIndexSeek`, not `AllNodesScan`.
- For bulk ingest, use `LOAD CSV` with `CALL { ... } IN TRANSACTIONS OF 10000 ROWS`, or `apoc.periodic.iterate(...)`. A single transaction holding millions of writes will run out of heap.

## Common pitfalls

- Modeling with nodes for things that should be relationship properties (e.g., a `:Friendship` node between two users when a `[:FRIENDS_WITH]` relationship would do). The extra hop slows every query.
- Storing many properties as a JSON blob on a node. Neo4j cannot index inside it, and you lose every reason to be on a graph database.
- Running `MERGE` without an index/constraint on the key property. Each `MERGE` becomes a label scan, and concurrent writers can race to create duplicates.
- Unbounded variable-length patterns (`[:REL*]` with no upper bound) on dense graphs. Easy to traverse millions of paths and OOM the server.
- Using Cypher to compute analytics like PageRank or community detection. Use the Graph Data Science (GDS) library; it runs in native memory and is orders of magnitude faster.
- Forgetting that relationships have direction in storage. `(a)-[:KNOWS]->(b)` is not the same row as `(b)-[:KNOWS]->(a)`. Either pick a canonical direction and query undirected, or create both.
- Treating Bolt sessions as cheap to leave open. Use the driver's session/transaction lifecycle properly and close sessions; long idle sessions hold resources.
- Letting APOC procedures run unbounded. `apoc.periodic.iterate` needs a sane batch size and parallel setting; defaults are not always right for your workload.

## Reference

- Official docs: https://neo4j.com/docs/
- Cypher manual: https://neo4j.com/docs/cypher-manual/current/
- APOC procedures: https://neo4j.com/docs/apoc/current/
- Graph Data Science: https://neo4j.com/docs/graph-data-science/current/
