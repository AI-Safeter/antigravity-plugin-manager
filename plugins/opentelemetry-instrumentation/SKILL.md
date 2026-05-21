---
name: opentelemetry-instrumentation
description: OpenTelemetry instrumentation for traces, metrics, and logs using the OTLP exporter, auto-instrumentation libraries, and semantic conventions. Use this skill when adding distributed tracing to services, exporting telemetry to Jaeger/Tempo/Honeycomb/Datadog, configuring the OTel Collector, or following OpenTelemetry semantic conventions.
---

# OpenTelemetry Instrumentation

OpenTelemetry (OTel) is the vendor-neutral CNCF standard for traces, metrics, and logs. You instrument your app with the OTel SDK, export over OTLP (gRPC or HTTP), and any compatible backend (Jaeger, Tempo, Honeycomb, Datadog, New Relic, Grafana Cloud) can ingest it. The big wins are auto-instrumentation and the freedom to swap backends without changing app code.

## Use this skill when

- Adding distributed tracing across microservices
- Exporting traces/metrics to Jaeger, Tempo, Honeycomb, or any OTLP backend
- Configuring the OTel Collector as a telemetry pipeline
- Replacing vendor-specific agents (Datadog dd-trace, New Relic) with a portable stack
- Following semantic conventions (`http.method`, `db.system`, `messaging.system`)
- Correlating logs with trace IDs

## Do not use this skill when

- You only need error reporting (use Sentry directly)
- You're committed to a single APM vendor's proprietary agent and don't need portability
- The runtime has no OTel SDK and writing one is out of scope

## Core concepts

A `Tracer` produces `Spans`; spans nest into a `Trace` identified by a `trace_id`. A `Meter` produces metrics (counters, gauges, histograms). Context propagation (W3C `traceparent` header) carries trace context across service boundaries. The `Resource` describes the entity producing telemetry (`service.name`, `service.version`, `deployment.environment`). The `OTel Collector` is a separate process that receives, transforms, and forwards telemetry.

## Quick start

```bash
# Node.js
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http
```

```javascript
// tracing.js -- load BEFORE your app: `node --require ./tracing.js app.js`
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'checkout-api',
    [ATTR_SERVICE_VERSION]: process.env.GIT_SHA,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

```python
# Python -- zero-code instrumentation
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install
OTEL_SERVICE_NAME=checkout-api \
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4317 \
opentelemetry-instrument python app.py
```

## Key patterns

### Auto-instrumentation
`@opentelemetry/auto-instrumentations-node` and Python's `opentelemetry-instrument` wrap HTTP frameworks, DB clients (pg, mysql, redis, mongo), and gRPC automatically. Start here before writing manual spans.

### Manual spans
```javascript
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('checkout');
await tracer.startActiveSpan('compute_total', async (span) => {
  try {
    span.setAttribute('cart.size', items.length);
    return await compute(items);
  } finally {
    span.end();
  }
});
```

### Context propagation
Auto-instrumentations inject/extract W3C `traceparent` headers on HTTP and gRPC. For custom transports (Kafka, SQS), use `propagation.inject(context.active(), carrier)` and `propagation.extract(...)` on the consumer side.

### OTel Collector
Run a Collector (sidecar or DaemonSet) with receivers (otlp), processors (batch, memory_limiter, attributes), and exporters (otlphttp, jaeger, prometheus). Apps export to the local Collector; the Collector handles auth/retries/transformations and fans out to backends.

### Sampling
Use `traceIdRatioBased(0.1)` for head-based sampling. For tail-based (keep all errors and slow traces), do it in the Collector with `tail_sampling` processor.

### Semantic conventions
Use the constants from `@opentelemetry/semantic-conventions` (`ATTR_HTTP_REQUEST_METHOD`, `ATTR_DB_SYSTEM_NAME`, `ATTR_MESSAGING_SYSTEM`). Backends and dashboards expect these exact attribute names.

## Common pitfalls

- **Loading SDK after app code**: imports that happen before `sdk.start()` are not auto-instrumented. Use `--require` (Node) or `opentelemetry-instrument` (Python).
- **Missing `service.name`**: traces show up as "unknown_service" and are nearly impossible to filter. Always set it via env (`OTEL_SERVICE_NAME`) or Resource.
- **Wrong OTLP endpoint port**: gRPC uses 4317, HTTP uses 4318. The endpoint URL must match the exporter type.
- **`OTEL_EXPORTER_OTLP_ENDPOINT` path confusion**: with HTTP exporters, some libs append `/v1/traces` automatically, some don't. Verify with a test trace.
- **100% sampling in prod**: explodes cost. Default to 5-10% head-based or tail-based on errors/latency.
- **Custom span names with high cardinality**: spans named `/users/12345` instead of `/users/:id` blow up backend cardinality.
- **Synchronous shutdown**: forgetting `sdk.shutdown()` on SIGTERM drops the last batch of spans.

## Reference

- Official docs: https://opentelemetry.io/docs/
- Semantic conventions: https://opentelemetry.io/docs/specs/semconv/
- Collector: https://opentelemetry.io/docs/collector/
- Language SDKs: https://opentelemetry.io/docs/languages/
- Related: [[sentry-error-tracking]], [[langfuse-observability]]
