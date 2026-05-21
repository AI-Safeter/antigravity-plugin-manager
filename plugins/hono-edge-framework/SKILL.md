---
name: hono-edge-framework
description: Hono ultralight web framework that runs on Cloudflare Workers, Bun, Deno, Node, Vercel, and Lambda. Use this skill when building edge APIs, picking the right adapter, using middleware (cors, logger, jwt), serving JSX at the edge, or exporting a type-safe `hc` RPC client from a Hono app.
---

# Hono Edge Web Framework

Hono is a small, fast web framework built on the Web Fetch standard (`Request`/`Response`), with adapters for every major JS runtime. It is the right default for Cloudflare Workers, Bun, and Deno, and a strong choice for portable APIs that may move between runtimes. Routing is regex-trie based and the bundle stays tiny.

## Use this skill when

- Targeting Cloudflare Workers, Bun, Deno, or Vercel Edge — runtimes that expect Web `fetch` handlers
- Building a small JSON API where bundle size and cold start matter
- Composing middleware (`cors`, `logger`, `jwt`, `basicAuth`, `etag`, `compress`)
- Rendering JSX/HTML at the edge with `hono/jsx`
- Exposing a type-safe RPC client to a TypeScript frontend with `hc<typeof app>`
- Validating request bodies/query with `@hono/zod-validator`

## Do not use this skill when

- You need a mature plugin ecosystem with deep validation, OpenAPI, and lifecycle hooks — use [[fastify-nodejs]]
- The service is a long-lived stateful Node server with heavy filesystem use; Express/Fastify on Node are fine
- You want end-to-end RPC across a TS monorepo with React Query bindings — use [[trpc-typesafe-api]]

## Core concepts

A Hono app is `new Hono()`. Routes register `app.get`, `app.post`, etc.; handlers receive a `Context` (`c`) and return a `Response` (or call helpers like `c.json`, `c.text`, `c.html`). The same app object is exported per-runtime: Workers (`export default app`), Bun (`export default { fetch: app.fetch }`), Node (`serve({ fetch: app.fetch })` from `@hono/node-server`). Types flow from route definitions into the `hc` client.

## Quick start

```ts
// npm i hono @hono/zod-validator zod
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

type Bindings = { DB: D1Database; JWT_SECRET: string };
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", logger());
app.use("/api/*", cors({ origin: "https://example.com" }));

app.get("/health", (c) => c.json({ ok: true }));

const route = app.post(
  "/api/users",
  zValidator("json", z.object({ email: z.string().email() })),
  async (c) => {
    const { email } = c.req.valid("json");
    const row = await c.env.DB.prepare("INSERT INTO users(email) VALUES (?) RETURNING *")
      .bind(email).first();
    return c.json(row, 201);
  },
);

export type AppType = typeof route;
export default app; // Cloudflare Workers / Bun
```

## Key patterns

### Per-runtime entry points
- Cloudflare Workers: `export default app;` (uses `fetch(request, env, ctx)`).
- Bun: `export default { port: 3000, fetch: app.fetch };` or just `export default app`.
- Deno: `Deno.serve(app.fetch)`.
- Node: `import { serve } from "@hono/node-server"; serve({ fetch: app.fetch, port: 3000 });`.
- AWS Lambda: `handle(app)` from `hono/aws-lambda`.

### Typed `Bindings` and `Variables`
```ts
type Bindings = { DB: D1Database; KV: KVNamespace };
type Variables = { userId: string };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => { c.set("userId", "u1"); await next(); });
```
`Bindings` = runtime env (Workers env, secrets). `Variables` = per-request state set by middleware.

### Validators
- `zValidator("json" | "form" | "query" | "param" | "header", schema)` populates `c.req.valid("json")` with the parsed, typed value.
- Validators short-circuit with 400 on failure unless you pass a hook to customize.

### RPC client (`hc`)
```ts
// client.ts
import { hc } from "hono/client";
import type { AppType } from "./server";
const client = hc<AppType>("https://api.example.com");
const res = await client.api.users.$post({ json: { email: "a@b.com" } });
if (res.ok) { const user = await res.json(); }
```
Type inference requires exporting the chained `app.post(...)` value, not the bare `app`.

### JSX at the edge
```tsx
// tsconfig: "jsx": "react-jsx", "jsxImportSource": "hono/jsx"
app.get("/", (c) => c.html(<h1>Hello {c.req.query("name") ?? "world"}</h1>));
```

### Streaming and SSE
- `c.streamSSE(async (s) => { await s.writeSSE({ data: "hi" }); })` for server-sent events.
- `c.stream(async (s) => { await s.write("chunk"); })` for raw streaming.

## Common pitfalls

- Using Node APIs (`fs`, `path`, `process.env`) inside a Workers handler; they are not available—use Bindings.
- Long-running background work after `return c.json(...)`; on Workers you must use `c.executionCtx.waitUntil(promise)` or the work is killed.
- Forgetting to export the chained route value for `hc` and ending up with `any` on the client.
- Misordering middleware: middleware applies in registration order, and `c.set` must run before handlers that read it.
- Returning a raw object from a handler instead of `c.json(...)`; Hono will not auto-serialize.
- Using `app.use(cors())` without a path; it applies globally only if mounted with `"*"`.
- Assuming Node-style request bodies; on edge runtimes you must `await c.req.json()` once and cache—`Request` body is a single-use stream.

## Reference
- Official docs: https://hono.dev
- Related: [[fastify-nodejs]], [[trpc-typesafe-api]]
