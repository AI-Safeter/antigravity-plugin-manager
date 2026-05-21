---
name: express-nodejs
description: Build HTTP APIs and web servers with Express.js on Node.js. Covers routing, middleware order, request/response API, error-handling middleware, async/await patterns, body parsing, static files, security middleware (helmet, CORS), and production hardening.
---

# Express on Node.js

Express is a thin, unopinionated HTTP framework for Node.js. Everything in Express is a middleware function with the signature `(req, res, next)` (or `(err, req, res, next)` for error handlers). Mastering Express means mastering middleware order, the request lifecycle, and how errors propagate.

## Use this skill when

- Building a REST or RPC HTTP API in Node.js
- Wiring middleware (auth, logging, parsing, rate limiting) for an HTTP server
- Debugging route matching, 404s, or "headers already sent" errors
- Hardening an Express app for production (helmet, CORS, trust proxy, timeouts)
- Migrating callback-style handlers to async/await
- Integrating Express with a reverse proxy, sessions, or static asset serving

## Do not use this skill when

- Building a GraphQL server where Apollo or Yoga is the entrypoint (Express is only a host)
- The project uses Fastify, Hono, Koa, or Nest — error handling and middleware semantics differ
- You only need a static file server (`serve`, `nginx`, or `http.createServer` is simpler)

## Core concepts

- **Middleware chain**: Express executes registered middleware in the order it was added with `app.use(...)` or `router.METHOD(...)`. Each handler must either call `next()`, call `next(err)`, or end the response with `res.send`/`res.json`/`res.end`.
- **Error-handling middleware** has exactly four arguments: `(err, req, res, next)`. Express identifies it by arity; three-arg handlers are normal middleware. Register error handlers **last**.
- **`req` / `res` API**: `req.params`, `req.query`, `req.body`, `req.headers`, `req.ip`, `req.method`, `req.path`. Responses use `res.status(code)`, `res.json(obj)`, `res.send(body)`, `res.set(header, value)`, `res.redirect(url)`, `res.sendFile(path)`.
- **Routers** are mini-apps. Compose with `app.use('/api/v1', router)` to mount under a prefix.
- **Async errors**: Express 4 does not catch rejected promises from async handlers. Express 5 (in beta/stable) does. Use Express 5 or `express-async-errors` for 4.
- **`trust proxy`**: behind a load balancer, set `app.set('trust proxy', 1)` so `req.ip` and `req.protocol` reflect the original client.

## Quick start

```js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'express-async-errors'; // only needed on Express 4

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: ['https://app.example.com'], credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/users/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(user);
});

// 404 handler — last non-error middleware
app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// Error handler — 4 arguments, registered last
app.use((err, req, res, next) => {
  req.log?.error({ err }, 'unhandled');
  res.status(err.status ?? 500).json({ error: err.code ?? 'internal' });
});

app.listen(3000);
```

## Key patterns

- **Centralize error handling**. Throw typed errors from handlers and translate them in one error middleware. Do not call `res.json` from inside `catch` blocks scattered through routes.
- **Validate input at the edge**. Use Zod, Valibot, or `express-validator` in a middleware that populates `req.validated` or rejects with 400. Never trust `req.body`, `req.query`, or `req.params` directly.
- **Use routers per resource**. One `router.js` per resource (`users`, `orders`) mounted under `/api/v1/...`. Keeps route ownership clear and tests focused.
- **Stream large responses** with `res.write` / `pipeline(readable, res)` instead of buffering with `res.send`. Set `Content-Type` and `Transfer-Encoding: chunked` semantics implicitly via `res.write`.
- **Graceful shutdown**: capture the `http.Server` from `app.listen`, listen for `SIGTERM`, call `server.close()`, and exit after in-flight requests drain. Required for clean rolling deploys.
- **Static files**: `app.use('/static', express.static('public', { maxAge: '1y', immutable: true }))` — set long cache lifetimes only for hashed asset filenames.

## Common pitfalls

- **Forgetting `next(err)`**: in callback-style code, throwing inside a setTimeout/event handler bypasses Express. Always pass errors to `next` or use async/await with Express 5.
- **Wrong middleware order**: registering `express.json()` *after* a route means `req.body` is undefined in that route. Body parsers must be mounted before the routes that use them.
- **"Cannot set headers after they are sent"**: caused by calling `res.send` (or `res.json`) twice, or by calling `next()` *after* responding. Return after sending: `return res.json(...)`.
- **Trusting `req.ip` without `trust proxy`**: behind nginx/ALB you will see the proxy's IP. Set `app.set('trust proxy', 1)` (or a CIDR list) so `X-Forwarded-For` is honored.
- **Open CORS in production**: `cors()` with no options reflects the origin and allows credentials when asked. Always pass an explicit `origin` allowlist.
- **No request timeout**: a slow upstream can hold connections forever. Set `server.requestTimeout` and `server.headersTimeout`, or use a per-route timeout middleware.
- **Logging the body unredacted**: `morgan`/`pino-http` will happily log passwords and tokens. Redact sensitive fields before logging.

## Reference

- Express docs: https://expressjs.com
- Express 5 migration: https://expressjs.com/en/guide/migrating-5.html
- Helmet: https://helmetjs.github.io
- Node.js HTTP server timeouts: `requestTimeout`, `headersTimeout`, `keepAliveTimeout`
- Recommended stack: Express 5 + Zod + pino-http + helmet + cors + express-rate-limit
