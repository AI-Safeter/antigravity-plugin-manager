---
name: redis-caching
description: Use Redis as a cache, session store, queue, or real-time pub/sub layer. Covers data types (string, hash, list, set, sorted set, stream, hyperloglog, geo), TTL and eviction policies, Lua scripting with EVAL, pipelining, MULTI/EXEC transactions, RDB vs AOF persistence, and Redis Streams.
---

# Redis

Redis is an in-memory key-value store with a rich type system. Every command is single-threaded on the main thread, so atomicity is free but a single slow command blocks all clients. Design around small, fast operations.

## Use this skill when

- Adding a cache layer in front of a slow data source
- Storing session tokens, rate limits, or short-lived counters
- Implementing leaderboards, recent-activity feeds, or time-windowed counters with sorted sets
- Building pub/sub, work queues, or event streams (`XADD`/`XREADGROUP`)
- Choosing an eviction policy (`allkeys-lru`, `volatile-ttl`) and persistence mode (RDB vs AOF)
- Writing atomic multi-step logic via `EVAL`/Lua or `MULTI`/`EXEC`

## Do not use this skill when

- You need durable, queryable long-term storage as the source of truth
- You need rich joins or secondary indexes (use a real database)
- The working set will not fit in memory across the cluster

## Core concepts

Keys are flat strings; values are typed (string, list, hash, set, zset, stream, bitmap, hyperloglog, geo). TTLs are per-key. The server is single-threaded for command execution; clustering shards keys by CRC16 of the key (or the hash tag `{...}` if present).

## Quick start

```bash
# String with TTL (basic cache pattern)
SET user:42:profile '{"name":"Sam"}' EX 3600

# Hash for structured data
HSET order:1001 status PENDING total 4250 user_id 42
HEXPIRE order:1001 86400 FIELDS 1 status   # Redis 7.4+

# Sorted set leaderboard
ZADD leaderboard 1500 user:42
ZRANGE leaderboard 0 9 REV WITHSCORES

# Stream-based queue
XADD orders '*' order_id 1001 status PENDING
XREADGROUP GROUP workers worker-1 COUNT 10 BLOCK 5000 STREAMS orders '>'
```

## Key patterns

- Always set a TTL on cached entries (`SET key val EX seconds` or `EXPIRE`). Caches without TTLs become memory leaks.
- Pick eviction up front: `maxmemory 8gb` plus `maxmemory-policy allkeys-lru` for a pure cache, `volatile-lru` if you mix cache and durable keys (only TTL-bearing keys are evicted), `noeviction` for a queue/store where loss is unacceptable.
- Use pipelining to batch round trips: send N commands without waiting for responses, then read N responses. Cuts RTT dominance dramatically.
- `MULTI`/`EXEC` is atomic but not isolated against reads; commands inside a transaction queue and execute as one unit. For read-modify-write, prefer Lua via `EVAL` or `EVALSHA`.
- Sorted sets (`ZSET`) are the right tool for any "top N", "between time T1 and T2", or "rank of X" question. `ZADD`/`ZRANGEBYSCORE`/`ZREMRANGEBYSCORE` are O(log N).
- Streams (`XADD`/`XREADGROUP`/`XACK`) replace list-based queues for fan-out, consumer groups, and replay. Track `XPENDING` and `XCLAIM` to recover stuck messages.
- Cluster hash tags: to keep related keys on one shard for `MGET`/`MULTI`, give them a common tag like `user:{42}:profile` and `user:{42}:cart`.
- Persistence: RDB is a periodic snapshot (fast restart, possible data loss between snapshots). AOF appends every write (more durable, slower, larger). The standard "best of both" is `aof-use-rdb-preamble yes` with `appendfsync everysec`.
- Pub/sub (`PUBLISH`/`SUBSCRIBE`) is fire-and-forget. Slow subscribers get disconnected. Use Streams when you need durability or replay.

## Common pitfalls

- Running `KEYS *` in production. It blocks the server for the full scan. Use `SCAN` with a cursor and `MATCH` pattern.
- Storing a million-element list, then doing `LRANGE 0 -1`. That single command can stall every other client for seconds. Cap collections or shard them.
- Using `EXPIRE` on a key, then `SET key new_value` without `KEEPTTL`. The TTL is reset to none. Use `SET key new_value KEEPTTL` or re-issue `EXPIRE`.
- Treating `INCR` over HTTP as a global rate limiter without bounding key cardinality. One key per user per minute is fine; one key per request id is a memory bomb.
- Assuming pub/sub is reliable. It is not. Disconnects drop messages with no replay. Use Streams with consumer groups for delivery guarantees.
- Writing long-running Lua scripts. They block the server. Keep `EVAL` scripts to small, bounded loops; use `redis.call('SCAN', ...)` outside Lua for big sweeps.
- Forgetting that `MULTI`/`EXEC` does not roll back on logic errors; only syntax errors during `MULTI` abort. A failed command inside the transaction does not undo the others.

## Caching patterns

- Cache-aside (lazy): app reads from cache; on miss, loads from source and `SET`s with TTL. Simple and the default for most code paths.
- Write-through: app writes to cache and source together. Keeps cache hot but doubles write latency.
- Write-behind: write to cache, queue a background write to source. Fast but adds a durability gap.
- Stampede protection: use `SET key val NX EX ttl` plus a short randomized "lock" key so only one worker rebuilds a hot key after expiry. Alternatively, refresh-ahead with a soft TTL.
- Negative caching: cache "not found" results too, with a shorter TTL, to avoid hammering the source on missing keys.

## Cluster and high availability

- Redis Sentinel manages failover for a primary/replica setup without sharding. Clients connect to Sentinels to discover the current primary.
- Redis Cluster shards keys across nodes (16384 hash slots). Multi-key commands require all keys to hash to the same slot; use hash tags `{user:42}`.
- `WAIT numreplicas timeout` blocks until N replicas acknowledge prior writes. Useful for soft-durable handoffs without full sync replication.

## Reference

- Official docs: https://redis.io/docs/
- Commands reference: https://redis.io/commands/
- Persistence guide: https://redis.io/docs/management/persistence/
- Cluster spec: https://redis.io/docs/reference/cluster-spec/
