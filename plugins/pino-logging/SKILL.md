---
name: pino-logging
description: 'Pino structured logging for Node.js. Use this skill when adding or refactoring logging in a Node service, configuring child loggers, setting up transports for files/HTTP/Elastic, redacting secrets from log output, pretty-printing in dev with pino-pretty, integrating with Fastify or Express, or designing log level policy. Triggers: pino, pino-pretty, pino.transport, redact, child logger, structured logging, logger.info, fastify logger.'
---

# Pino Structured Logging

Pino is the fastest production logger for Node.js: synchronous-looking API, asynchronous writes via worker threads, JSON output by default. The right mental model is "log events as objects, not strings." Pino emits one JSON line per log record so log aggregators (Datadog, Elastic, Loki, CloudWatch) can index every field.

## Use this skill when
- Setting up logging in a new Node service (HTTP API, worker, CLI)
- Replacing `console.log` or Winston with Pino
- Adding child loggers per request, per job, or per tenant
- Configuring `pino.transport()` for files, HTTP sinks, or external services
- Pretty-printing locally with `pino-pretty` but staying JSON in prod
- Redacting passwords, tokens, cookies, and PII from log output
- Wiring the built-in logger in Fastify or attaching Pino to Express

## Do not use this skill when
- The runtime is the browser -- use a browser logger or a backend forwarder
- You need a metrics system -- use Prometheus/OpenTelemetry instead of log scraping
- The app is a one-off script where `console.log` is fine

## Core concepts
A Pino `logger` is an instance with methods per level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). Each call serializes a JSON object: timestamp, level number, pid, hostname, plus any merged object and msg. Child loggers add bound fields (`requestId`, `userId`) without re-paying serialization cost. Transports run in worker threads so the main thread doesn't block on I/O.

## Quick start
```ts
// logger.ts
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "checkout", env: process.env.NODE_ENV },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" } }
    : undefined,
});

logger.info({ orderId: "o_123", total: 4299 }, "order placed");
logger.error({ err: new Error("boom") }, "payment failed");
```

## Key patterns

### Log objects, not strings
- Signature is `(mergeObj, msg)` not `(msg, ...args)`. First argument is structured data, second is human-readable text.
- Correct: `logger.info({ userId, durationMs }, "request done")`. Searchable in any aggregator.
- Wrong: `logger.info(\`user $\{userId} done in $\{durationMs}ms\`)`. Free text, no fields to query.

### Child loggers
- Attach context once, inherit everywhere:
```ts
const reqLog = logger.child({ requestId: req.id, route: req.url });
reqLog.info("handling");
reqLog.warn({ retry: 1 }, "external call slow");
```
- Children are cheap; create one per HTTP request, job, or saga step.
- Bound fields appear on every record without re-passing them.

### Log levels strategy
- `trace` (10): verbose dev-only call traces, off in prod.
- `debug` (20): branch decisions, cache hits, retry attempts. Enable temporarily in prod via env var.
- `info` (30): one record per important business event (order placed, user signed up). Default prod level.
- `warn` (40): recoverable anomalies (retry, fallback, slow dependency).
- `error` (50): a request/job failed; user impact. Always include an `err` field.
- `fatal` (60): process about to exit. Pair with `process.exit(1)` after flush.
- Set `level` from env so you can dial verbosity without redeploys.

### Error serialization
- Use the `err` key by convention: `logger.error({ err }, "db down")`. Pino's default `err` serializer extracts `type`, `message`, `stack`.
- Customize: `serializers: { err: pino.stdSerializers.err }` (already default in newer versions).
- Add request serializer for HTTP: `serializers: { req: pino.stdSerializers.req, res: pino.stdSerializers.res }`.

### Transports
- `pino.transport({ target, options })` spawns a worker; main thread stays fast.
- Multiple destinations:
```ts
const transport = pino.transport({
  targets: [
    { target: "pino/file", options: { destination: "/var/log/app.log" }, level: "info" },
    { target: "pino-elasticsearch", options: { node: "http://es:9200", index: "app" }, level: "warn" },
    { target: "pino-pretty", options: { colorize: false }, level: "debug" },
  ],
});
export const logger = pino({ level: "debug" }, transport);
```
- Common targets: `pino/file`, `pino-pretty`, `pino-loki`, `pino-elasticsearch`, `pino-datadog-transport`, `pino-http-send`.
- Transports run as ESM workers; avoid requiring CJS-only modules inside transport files.

### Redaction
- `redact: { paths, censor, remove }` censors or removes nested fields before serialization.
- Paths support wildcards: `"*.password"`, `"req.headers.authorization"`, `"users[*].email"`.
- `remove: true` deletes the field entirely; default censor replaces with `"[Redacted]"`.
- Redact is fast (~no overhead when paths don't match) and runs before any transport sees the record.

### HTTP server integration
- Fastify ships Pino built in. Configure via `Fastify({ logger: { level: "info", redact: [...] } })`. `request.log` is a child logger with `reqId`.
- Express: use `pino-http` middleware:
```ts
import pinoHttp from "pino-http";
app.use(pinoHttp({ logger, customLogLevel: (req, res, err) =>
  err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info" }));
```
- `req.log` is a per-request child; use it inside handlers for request-scoped fields.

### Pretty-printing in dev
- Never pretty-print in production -- it parses+reformats every record and loses structure.
- Pipe in shell instead of in-process when convenient: `node app.js | pino-pretty`.
- Or conditional transport: only attach `pino-pretty` when `NODE_ENV !== "production"`.

### Async flush on shutdown
- Pino buffers writes. On SIGTERM/SIGINT:
```ts
process.on("SIGTERM", () => {
  logger.flush();
  setTimeout(() => process.exit(0), 200);
});
```
- Use `pino.final(logger, (err, finalLogger) => { ... })` to log a last message synchronously on fatal errors.

## Common pitfalls
- Reversed args: `logger.info("user signed up", { userId })` -- the object becomes the `msg`, your message is lost. Object first, string second.
- Logging full request bodies: leaks PII and bloats log volume. Whitelist fields or use serializers.
- `pino-pretty` in production: slow, defeats structured logging, makes ingestion brittle.
- Forgetting to redact `Authorization` and `Cookie` headers; the default does not redact them.
- Spawning a transport per child logger: transports are global; pass one transport stream to the root logger.
- Logging `err` as a property of a plain object: `{ error: e }` won't be serialized as stack-trace-rich JSON. Use `{ err: e }`.
- Setting level via `logger.level = "debug"` and forgetting to set the same level on child loggers' future siblings -- children inherit at creation time.
- Mixing CJS and ESM transport targets: transports run in worker threads with ESM loader; CJS-only targets need a wrapper.

## Reference
- Official docs: https://getpino.io/
- API reference: https://github.com/pinojs/pino/blob/main/docs/api.md
- Transports: https://github.com/pinojs/pino/blob/main/docs/transports.md
- Redaction: https://github.com/pinojs/pino/blob/main/docs/redaction.md
- Related: [[fastify-api]], [[nodejs-observability]], [[opentelemetry-tracing]]
