---
name: fastify-nodejs
description: Fastify high-performance Node.js web framework with JSON Schema validation, plugin encapsulation, lifecycle hooks, and type providers. Use this skill when building production HTTP APIs on Node, defining route schemas for validation and serialization, organizing code with `fastify-plugin`, or wiring up TypeBox/Zod type providers for end-to-end types.
---

# Fastify on Node.js

Fastify is a low-overhead Node.js web framework built around JSON Schema for request validation and response serialization (via `fast-json-stringify`). Schemas double as documentation (Swagger/OpenAPI plugins) and unlock major throughput gains. Use it when you want a mature Node-native HTTP server with strong validation and a plugin model.

## Use this skill when

- Building a production Node HTTP API where schema-driven validation matters
- Designing routes with `schema: { body, querystring, params, response }`
- Organizing code with the plugin system (`fastify.register`, `fastify-plugin`) and encapsulation
- Using hooks (`onRequest`, `preHandler`, `preValidation`, `onSend`, `onError`)
- Adding type safety with `TypeBoxTypeProvider` or `ZodTypeProvider`
- Generating OpenAPI via `@fastify/swagger`

## Do not use this skill when

- You are deploying to edge runtimes (Cloudflare Workers, Deno Deploy) — use [[hono-edge-framework]]
- You only need a thin file-based API for a frontend; Next.js/Remix route handlers may be simpler
- You need end-to-end TypeScript RPC inside a monorepo — use [[trpc-typesafe-api]]

## Core concepts

A Fastify app is `Fastify()`; routes are added with `.get`, `.post`, etc. Every route can declare a JSON Schema for inputs (validated with Ajv) and outputs (serialized with `fast-json-stringify`, which is faster than `JSON.stringify` but DROPS fields not in the schema). Plugins are functions that receive a scoped instance; `fastify-plugin` opts out of encapsulation so decorators leak to the parent.

## Quick start

```ts
// npm i fastify @fastify/sensible @sinclair/typebox @fastify/type-provider-typebox
import Fastify from "fastify";
import { Type } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

app.post("/users", {
  schema: {
    body: Type.Object({ email: Type.String({ format: "email" }) }),
    response: {
      201: Type.Object({ id: Type.Number(), email: Type.String() }),
    },
  },
  handler: async (req, reply) => {
    // req.body is typed as { email: string }
    const user = { id: 1, email: req.body.email };
    return reply.code(201).send(user);
  },
});

await app.listen({ port: 3000, host: "0.0.0.0" });
```

## Key patterns

### Schema-driven routes
- `body`, `querystring`, `params`, `headers` validate input; failures return 400 with details.
- `response: { 200: schema, 4xx: schema }` enables fast serialization and acts as a contract.
- Fields not present in the response schema are STRIPPED from the JSON output—this is a feature, not a bug.

### Plugins and encapsulation
- `app.register(plugin)` creates a child scope: decorators, hooks, and routes added inside DO NOT leak out.
- Wrap with `fastify-plugin` (`fp(plugin)`) to publish decorators to the parent scope (e.g., a `db` decorator).
```ts
import fp from "fastify-plugin";
export default fp(async (app) => { app.decorate("db", makeDb()); });
```

### Hooks (request lifecycle)
- Order: `onRequest` → `preParsing` → `preValidation` → `preHandler` → handler → `preSerialization` → `onSend` → `onResponse`.
- Auth typically goes in `preHandler` so route schemas still validate first.
- `onError` for centralized error logging.

### Type providers
- TypeBox: `Type.Object({...})` schemas double as types; preferred for pure JSON Schema.
- Zod: `import { ZodTypeProvider } from "fastify-type-provider-zod";` then `.withTypeProvider<ZodTypeProvider>()`; familiar API but requires `validatorCompiler`/`serializerCompiler` setup.

### Error handling
```ts
import { errors } from "@fastify/sensible";
app.setErrorHandler((err, req, reply) => {
  req.log.error({ err }, "request failed");
  if (err.validation) return reply.code(400).send({ message: err.message });
  reply.code(500).send({ message: "internal" });
});
```

### Performance knobs
- `Fastify({ logger: { level: "info" } })`: pino by default — fast, JSON.
- Disable `keepAliveTimeout` tuning only after measuring.
- Avoid `reply.send(largeObject)` without a response schema; serialization is `JSON.stringify` and slower.

## Common pitfalls

- Response schema strips unknown fields silently; if a property is missing from the JSON, the schema is wrong, not the handler.
- Registering decorators in a child plugin without `fastify-plugin` and being surprised they are not visible to siblings.
- Calling `await app.listen(...)` before all `register` promises resolve; use `await app.ready()` or `await app.listen(...)` (which waits internally) but DO NOT add routes after `listen`.
- Using Zod schemas directly in `schema.body` without installing a Zod type provider and compilers — Ajv will reject them.
- Mixing `reply.send()` and `return value` in the same handler; pick one. With async handlers, prefer `return`.
- Logging the full request body in `onRequest`; bodies are not parsed yet—use `preHandler`.
- Forgetting `host: "0.0.0.0"` in Docker and finding the server unreachable from outside the container.

## Reference
- Official docs: https://fastify.dev/docs/latest/
- Related: [[hono-edge-framework]], [[trpc-typesafe-api]], [[sqlalchemy-orm]]
