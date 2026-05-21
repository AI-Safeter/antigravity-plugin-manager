---
name: mysql
description: Design and tune MySQL/MariaDB schemas and queries. Use for InnoDB engine specifics, B-tree/FULLTEXT/spatial indexes, JOIN planning with EXPLAIN, transactions and isolation levels, binlog replication, JSON columns, performance schema, and common config tuning.
---

# MySQL / MariaDB

MySQL is a relational database with InnoDB as the default storage engine. Unlike PostgreSQL, InnoDB clusters table data by primary key, which makes PK choice a physical layout decision, not just a logical one.

## Use this skill when

- Designing tables on InnoDB and choosing a primary key layout
- Adding or reorganizing indexes (B-tree, covering, prefix, FULLTEXT, spatial)
- Reading `EXPLAIN`/`EXPLAIN ANALYZE` output to fix slow JOINs
- Configuring transactions and isolation levels (`REPEATABLE READ`, `READ COMMITTED`)
- Setting up or troubleshooting binlog replication (async, semi-sync, GTID)
- Tuning `my.cnf`: buffer pool, redo log, `innodb_flush_log_at_trx_commit`

## Do not use this skill when

- You are on PostgreSQL, SQLite, or a NoSQL store
- You need MongoDB-style document modeling as the primary pattern
- You only need an in-memory cache

## Core concepts

InnoDB stores rows in a B+tree keyed by the primary key (clustered index). Secondary indexes store the PK value, so secondary lookups do two B-tree descents. Transactions use MVCC; the default isolation is `REPEATABLE READ` with gap locks, which differs from most other databases.

## Quick start

```sql
CREATE TABLE orders (
  order_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  status        ENUM('PENDING','PAID','CANCELED') NOT NULL DEFAULT 'PENDING',
  total_cents   BIGINT NOT NULL,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (order_id),
  KEY idx_user_created (user_id, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;
```

## Key patterns

- Use `BIGINT UNSIGNED AUTO_INCREMENT` for PKs unless you have a real reason to use UUIDs. If you must use UUIDs, store as `BINARY(16)` and use UUIDv7 so the clustered index stays append-friendly.
- Use `utf8mb4` (never `utf8`, which is a 3-byte alias and cannot store many emoji or CJK). Pair with `utf8mb4_0900_ai_ci` on MySQL 8 or `utf8mb4_unicode_ci` on older versions.
- Index FK columns explicitly. MySQL auto-creates an index on FK columns only if no usable index already exists; rely on explicit indexes instead of guessing.
- Read `EXPLAIN` columns in order: `type` (want `ref`, `range`, `eq_ref`, not `ALL`), `key` (which index used), `rows` (estimated scan), `Extra` (`Using index` is good, `Using filesort`/`Using temporary` is suspect).
- Use `DATETIME(6)` for human-meaningful timestamps and `TIMESTAMP` only if you want automatic UTC conversion; both store microseconds with `(6)`.
- Use `DECIMAL(p,s)` for money. Never `FLOAT`/`DOUBLE`.
- JSON columns are stored as a binary tree; index via generated columns: `ALTER TABLE t ADD c VARCHAR(64) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.k'))) STORED, ADD INDEX(c);`.
- Replication: GTID-based (`gtid_mode=ON`) is the modern default. Semi-sync (`rpl_semi_sync_master_enabled=1`) gives one-replica durability without full sync cost.
- Performance schema: `events_statements_summary_by_digest` shows top queries by total latency; `table_io_waits_summary_by_index_usage` reveals unused indexes.

## Common pitfalls

- Picking a random UUID as PK on InnoDB. Inserts land in random B-tree pages, causing page splits and bloating the clustered index.
- Using `utf8` instead of `utf8mb4`. Silent truncation of 4-byte characters.
- `SELECT ... WHERE col = 'value'` against a column with a different collation than the literal forces a full scan because the index cannot be used.
- Gap locks under `REPEATABLE READ` causing deadlocks on `INSERT ... SELECT` patterns. Switch to `READ COMMITTED` for high-concurrency OLTP if you do not need range stability.
- `OFFSET 100000 LIMIT 20` scans 100020 rows. Use keyset pagination: `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20`.
- `innodb_flush_log_at_trx_commit=2` or `=0` improves throughput but loses up to 1 second of transactions on crash. Keep at `1` for anything that matters.
- Implicit type conversion: `WHERE varchar_col = 42` casts every row to a number, defeating the index. Always quote string literals.
- FULLTEXT indexes require `MATCH ... AGAINST` syntax; a `LIKE '%term%'` query will not use them.

## Config tuning starter set

- `innodb_buffer_pool_size`: 50-75% of RAM on a dedicated database host. This is the single most impactful setting.
- `innodb_log_file_size`: 1-2 GB on modern systems. Larger means fewer flushes but longer crash recovery.
- `innodb_flush_method = O_DIRECT` on Linux to bypass the OS page cache (the buffer pool already caches).
- `max_connections`: do not raise beyond what the app actually needs. Each connection costs memory; use a connection pool instead.
- `slow_query_log = ON` with `long_query_time = 0.5` and `log_queries_not_using_indexes = ON` during tuning passes.

## MariaDB vs MySQL notes

- MariaDB forked at 5.5 and diverges in features: `JSON` is an alias for `LONGTEXT` (no binary format), sequences are real objects, `RETURNING` is supported on `INSERT`/`UPDATE`/`DELETE`.
- Replication is mostly compatible but GTID formats differ; do not mix MySQL and MariaDB in the same replication topology.
- If you need `CHECK` constraints enforced before MySQL 8.0.16, you are on MariaDB.

## Reference

- Official docs: https://dev.mysql.com/doc/refman/8.0/en/
- InnoDB internals: https://dev.mysql.com/doc/refman/8.0/en/innodb-storage-engine.html
- Performance schema: https://dev.mysql.com/doc/refman/8.0/en/performance-schema.html
- MariaDB docs: https://mariadb.com/kb/en/documentation/
