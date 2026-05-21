---
name: cloudflare-workers
description: Cloudflare Workers edge runtime with V8 isolates, wrangler CLI, and bindings (KV, R2, D1, Queues, Durable Objects, Workers AI, Vectorize). Use when building or debugging Workers, choosing between Cloudflare storage primitives, hitting CPU or subrequest limits, or wiring cron triggers and Durable Objects.
---

# Cloudflare Workers

Cloudflare Workers run JavaScript/TypeScript (and Wasm) on V8 isolates at every Cloudflare edge POP. There are no containers, no cold-start Lambda-style penalties, and no `node_modules` runtime by default. The mental model is closer to a service worker than to a server: a global `fetch` handler receives a `Request` and returns a `Response`, with bindings injected via the `env` object.

## Use this skill when

- Building HTTP APIs, edge middleware, or reverse proxies on Workers
- Choosing between KV, R2, D1, Durable Objects, Queues, and Vectorize for storage
- Configuring `wrangler.toml` (or `wrangler.jsonc`), bindings, environments, and secrets
- Adding cron triggers (`scheduled` handler) or Queue consumers
- Hitting CPU-time, subrequest, or memory limits and needing to refactor
- Integrating Workers AI or Vectorize for inference and vector search at the edge
- Adopting Durable Objects for stateful, single-instance coordination

## Do not use this skill when

- The workload needs long-running background processing (> 30s CPU, > 5 min wall)
- You need full Node.js APIs without `nodejs_compat` flags
- The question is about Cloudflare Pages static hosting only

## Core concepts

- **V8 isolates, not containers**: Each Worker is an isolate inside a shared V8 process. Startup is sub-millisecond. There is no filesystem, no child processes, and no native modules. Node built-ins require the `nodejs_compat` compatibility flag and a recent compatibility date.
- **Module Worker format**: New Workers use ES modules exporting a default object with `fetch`, `scheduled`, `queue`, `email`, etc. The legacy `addEventListener('fetch', ...)` "service worker" format is deprecated for new projects.
- **Bindings**: Resources (KV, R2, D1, Queues, Durable Objects, Workers AI, Vectorize, service bindings to other Workers, secrets, environment variables) are declared in `wrangler.toml` and exposed on the `env` argument. No SDK initialization needed.
- **Limits**: 10 ms CPU on the free plan, 30 s CPU on paid (50 ms is the typical comfortable target); 50 subrequests on free, 1000 on paid (Workers Paid Standard); 128 MB memory; 6 simultaneous open connections per invocation; request body 100 MB.
- **`ctx.waitUntil`**: Extends the lifetime of the event so a Promise can complete after the response is sent (logging, cache writes, fan-out). Replaces the older `event.waitUntil` in the service-worker format.

## Quick start

```bash
# Create a new TypeScript Worker
npm create cloudflare@latest my-worker -- --type=hello-world --ts

# Local dev (runs on the actual Workers runtime via workerd)
npx wrangler dev

# Add a secret
npx wrangler secret put OPENAI_API_KEY

# Deploy
npx wrangler deploy

# Tail live logs
npx wrangler tail
```

A minimal module Worker:

```ts
export interface Env {
 USERS: KVNamespace;
 DB: D1Database;
 QUEUE: Queue;
 OPENAI_API_KEY: string;
}

export default {
 async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
 const url = new URL(req.url);
 if (url.pathname === '/users') {
 const id = url.searchParams.get('id')!;
 const cached = await env.USERS.get(id);
 if (cached) return new Response(cached);
 const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
 ctx.waitUntil(env.USERS.put(id, JSON.stringify(row), { expirationTtl: 60 }));
 return Response.json(row);
 }
 return new Response('not found', { status: 404 });
 },
 async scheduled(_event, env, ctx) {
 ctx.waitUntil(env.QUEUE.send({ kind: 'nightly-rollup', at: Date.now() }));
 },
};
```

## Key patterns

### Picking a storage primitive

- **KV**: eventually consistent, global key-value, optimized for high read throughput. Writes propagate in roughly a minute. Use for config, feature flags, cached lookups. Not suitable for primary state with strong consistency.
- **R2**: S3-compatible object storage with zero egress. Use for blobs, uploads, backups. Pair with presigned URLs for browser uploads.
- **D1**: SQLite at the edge, replicated to read replicas. Strong consistency on the primary; reads can hit replicas. Good for relational data up to ~10 GB per database.
- **Durable Objects**: single-instance JavaScript objects with transactional storage. Use when you need strong consistency, coordination, or websockets per entity (chat room, game lobby, rate limiter).
- **Queues**: durable producer-consumer with batching, retries, and dead-letter queues. Pair with a Worker consumer.
- **Vectorize**: managed vector database for similarity search. Pair with Workers AI embeddings.

### Bindings in `wrangler.toml`

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "USERS"
id = "abc123..."

[[d1_databases]]
binding = "DB"
database_name = "app"
database_id = "..."

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "my-assets"

[[queues.producers]]
binding = "QUEUE"
queue = "jobs"

[triggers]
crons = ["0 * * * *"]
```

### Durable Objects

- Each DO instance is uniquely identified by an ID and runs in a single location (the first place it was accessed). All requests for that ID route to the same isolate, giving you serializable transactions on its `storage` API.
- Use `state.storage.transaction` for multi-key atomic writes. SQL-backed Durable Objects expose a SQLite database per instance.
- Hibernate websockets with `state.acceptWebSocket(ws)` so the DO can evict from memory between messages and not be billed for idle time.

### Cron triggers and Queues

- The `scheduled` handler runs on the schedule in `[triggers] crons`. Each invocation still has the standard CPU and subrequest budget. Wrap long work in `ctx.waitUntil`.
- Queue consumers receive batches; ack the whole batch implicitly by returning, or call `message.retry()` / `message.ack()` per message. Configure DLQ in the consumer settings.

### `ctx.waitUntil` and the response lifecycle

- Returning a `Response` ends the request but `waitUntil` keeps the isolate alive until those Promises resolve, up to the CPU/wall-time limit. Use it for cache writes, analytics, fan-out.
- A common bug: forgetting to `await` or `waitUntil` an async call and seeing it silently dropped after the response.

### Edge runtime limits - what to watch

- **CPU time** is wall-clock-ish but excludes I/O. Heavy JSON parsing, regex, or crypto can blow it past 50 ms. Profile with `wrangler dev --inspect`.
- **Subrequest count** includes every `fetch` from the Worker (to origins, KV, R2, D1, service bindings). Batching D1 with `db.batch()` counts as one subrequest.
- **Memory**: 128 MB per isolate; large in-memory caches across requests are not safe (isolates can be evicted at any time).
- **No persistent globals**: module-scope variables persist *within* an isolate but not across isolates. Treat them as a best-effort cache, never as source of truth.

## Common pitfalls

- Using Node APIs without `nodejs_compat` and a recent `compatibility_date`. The error is usually a cryptic `process is not defined` or `Buffer is not defined`.
- Reading or writing files with `fs`. Workers have no filesystem; package static assets via the Assets binding or R2.
- Storing primary state in KV and expecting read-your-writes. KV is eventually consistent; use D1 or a Durable Object for strong consistency.
- Spawning more than 6 concurrent outbound `fetch` calls - extra ones queue and burn CPU budget. Batch upstream where possible.
- Forgetting `ctx.waitUntil` on background work, then debugging why analytics writes don't appear after the response. Putting secrets in `wrangler.toml` vars - use `wrangler secret put` instead.
- Treating Durable Objects like a general database. Each DO is a single-writer point of contention; shard by entity, not by table.

## Reference

- Workers runtime APIs: developers.cloudflare.com/workers/runtime-apis
- Bindings reference: developers.cloudflare.com/workers/runtime-apis/bindings
- Wrangler commands: developers.cloudflare.com/workers/wrangler/commands
- Limits and pricing: developers.cloudflare.com/workers/platform/limits
- Durable Objects: developers.cloudflare.com/durable-objects
