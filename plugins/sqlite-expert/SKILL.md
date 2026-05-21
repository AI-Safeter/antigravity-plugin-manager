---
name: sqlite-expert
description: Use SQLite for embedded, single-file databases. Covers file-based deployment, WAL journal mode, PRAGMA tuning (synchronous, foreign_keys, journal_mode), FTS5 full-text search, the JSON1 extension, common table expressions, the sqlite3 CLI, and when SQLite is the right choice vs a client-server database.
---

# SQLite

SQLite is a single-file, in-process, transactional database. There is no server. Each connection opens the file directly. It is the most-deployed database in the world (every phone, every browser, every embedded device) and is genuinely production-grade for the right workloads.

## Use this skill when

- Choosing a database for desktop apps, mobile apps, CLI tools, or single-node services
- Building a local cache, queue, or audit log that does not need a separate process
- Configuring WAL mode and PRAGMA settings for a write-heavy or concurrent workload
- Adding full-text search via FTS5 or JSON document storage via JSON1
- Writing CTEs, recursive queries, or window functions in SQLite
- Migrating data with the `sqlite3` CLI (`.dump`, `.import`, `.backup`)

## Do not use this skill when

- Multiple machines must write to the same database concurrently (use Postgres/MySQL)
- You need fine-grained user/role permissions inside the database
- Write throughput needs to exceed a few thousand commits/sec on one host

## Core concepts

A database is a single file plus, in WAL mode, a `-wal` and `-shm` companion file. SQLite uses dynamic typing ("type affinity") rather than strict types unless you create a `STRICT` table. Concurrency: one writer, many readers, all serialized through the file lock. WAL mode lets readers continue during a write.

## Quick start

```sql
-- Tune connection before use
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;   -- 256 MB

CREATE TABLE orders (
  order_id   INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(user_id),
  status     TEXT NOT NULL CHECK (status IN ('PENDING','PAID','CANCELED')),
  total      REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
```

```bash
sqlite3 app.db ".schema orders"
sqlite3 app.db ".backup backup.db"
```

## Key patterns

- Always enable WAL (`PRAGMA journal_mode = WAL;`) for any concurrent workload. It survives across connections and is persisted in the database header.
- `PRAGMA synchronous = NORMAL` is the right default with WAL: durable across application crashes, and only loses the last transaction on a hard OS crash. `FULL` is safer but slower; `OFF` is dangerous.
- Foreign keys are **off by default**. Set `PRAGMA foreign_keys = ON` on every connection (it is per-connection, not persisted).
- Use `INTEGER PRIMARY KEY` to alias the built-in `rowid` (fastest possible lookups, no extra index). Use `STRICT` tables when you want real type checking.
- FTS5 for full-text search: `CREATE VIRTUAL TABLE docs_fts USING fts5(title, body, content='docs', content_rowid='id');` then maintain via triggers. Query with `SELECT ... WHERE docs_fts MATCH 'sqlite NEAR/3 wal'`.
- JSON1 is built in (since 3.38). Store JSON as `TEXT`, query with `json_extract(col, '$.path')`, index via generated columns: `name TEXT AS (json_extract(data, '$.name')) STORED, then CREATE INDEX ON t(name)`.
- Recursive CTEs are the standard tool for tree/graph traversal: `WITH RECURSIVE chain AS (SELECT ... UNION ALL SELECT ... FROM chain JOIN ...) SELECT * FROM chain`.
- For bulk loads, wrap inserts in a transaction (`BEGIN; ...; COMMIT;`). Inserting 100k rows can go from minutes to under a second.
- Backups: use `.backup` or the online backup API. Never copy a live database file; you will copy a half-written page.

## Common pitfalls

- Copying the `.db` file while the application is running. WAL contents are in a separate file and the copy will be inconsistent. Use `.backup` or `VACUUM INTO 'backup.db'`.
- Assuming the database enforces FKs. It does not, until you turn them on per connection. Set `PRAGMA foreign_keys = ON` in your connection pool initializer.
- Treating type affinity as strict types. A column declared `INTEGER` will happily store the string `'forty-two'` unless the table is `STRICT`.
- Writing from many threads of the same process. SQLite serializes writes; high contention causes `SQLITE_BUSY`. Set `PRAGMA busy_timeout = 5000` and serialize writes in application code.
- Long-running read transactions in WAL mode prevent checkpoint truncation, so the `-wal` file grows without bound. Close read transactions promptly or run periodic `PRAGMA wal_checkpoint(TRUNCATE)`.
- Using `DELETE FROM t` to clear a large table and expecting the file to shrink. SQLite reuses freelist pages; run `VACUUM` to reclaim disk space.
- Storing tons of large blobs (>1 MB each) directly. Performance degrades and backups balloon. Store blobs on disk and keep paths in the database, or use the SQLite "blob streaming" API.

## Reference

- Official docs: https://www.sqlite.org/docs.html
- When to use SQLite: https://www.sqlite.org/whentouse.html
- FTS5: https://www.sqlite.org/fts5.html
- JSON1: https://www.sqlite.org/json1.html
