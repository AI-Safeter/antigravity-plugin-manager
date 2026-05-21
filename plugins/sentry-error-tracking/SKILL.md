---
name: sentry-error-tracking
description: Sentry error tracking and performance monitoring across JavaScript, Python, Go, and other runtimes. Use this skill when configuring Sentry SDKs, uploading source maps, setting up release tracking, instrumenting performance traces, defining alerts, or adding breadcrumbs and custom context for debugging.
---

# Sentry Error Tracking

Sentry captures unhandled exceptions, performance traces, and logs from production applications and groups them into issues with full stack traces and context. Modern Sentry SDKs unify error monitoring and tracing (APM) behind one initialization call. The hard parts are usually source map upload, release tagging, and tuning sample rates.

## Use this skill when

- Adding error tracking to a new service (Node, Browser, Python, Go, Ruby, etc.)
- Setting up source map upload for readable JS/TS stack traces
- Tagging releases for regression detection (`release: 1.2.3`)
- Enabling performance monitoring (`tracesSampleRate`)
- Configuring alerts, issue ownership rules, or Slack/PagerDuty integration
- Filtering noisy errors with `beforeSend` or `ignoreErrors`

## Do not use this skill when

- You only need structured logs (use Loki, CloudWatch, Datadog logs)
- You need full APM with custom metrics dashboards (consider Datadog, New Relic)
- You want a self-hosted-only solution and cannot run Sentry's Docker stack

## Core concepts

An `event` is a single error or transaction. Sentry groups events into `issues` by a fingerprint (usually the top frames of the stack). `release` ties events to a deploy. `environment` separates prod/staging. `scope` carries user, tags, and breadcrumbs that get attached to subsequent events on that scope.

## Quick start

```bash
npm install @sentry/node @sentry/profiling-node
# or: pip install --upgrade sentry-sdk
```

```javascript
// Node.js -- call as early as possible, before requiring app modules
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE, // e.g. 'myapp@1.2.3'
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
});
```

```python
# Python
import sentry_sdk
sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    environment=os.environ.get("ENV", "development"),
    release=os.environ.get("SENTRY_RELEASE"),
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
)
```

## Key patterns

### Source maps (browser / Node)
Use `@sentry/cli` or the bundler plugins (`@sentry/webpack-plugin`, `@sentry/vite-plugin`, `@sentry/nextjs`). They upload maps and inject the release at build time. Without this, minified stack traces are unreadable.

### Release + deploy tracking
Set `release` to the Git SHA or semver. Run `sentry-cli releases new $RELEASE && sentry-cli releases finalize $RELEASE` in CI. This enables regression detection and "first seen in release" timelines.

### Custom context per request
```javascript
Sentry.withScope((scope) => {
  scope.setUser({ id: userId, email });
  scope.setTag('feature_flag', 'new_checkout');
  scope.setContext('order', { id: orderId, total });
  Sentry.captureException(err);
});
```

### Breadcrumbs
Sentry auto-records breadcrumbs (HTTP, console, navigation). Add custom ones with `Sentry.addBreadcrumb({ category: 'auth', message: 'user logged in', level: 'info' })`.

### Performance tracing
Auto-instrumentation covers Express/Fastify/Django/Flask/FastAPI HTTP, DB queries, and outgoing requests. For manual spans: `Sentry.startSpan({ name: 'db.aggregate' }, () => { ... })`.

### Filtering noise
Use `beforeSend(event, hint)` to drop events; `ignoreErrors: [/ResizeObserver/, 'Network request failed']` for known browser noise.

## Common pitfalls

- **Forgetting source maps**: minified `chunk.abc123.js:1:54321` is useless. Always upload maps and verify the release SHA matches.
- **Not setting `release`**: regressions, "first seen", and deploy markers all break without it.
- **DSN in client code is fine** but `auth tokens` for `sentry-cli` are not. Don't commit `.sentryclirc` with a token.
- **`tracesSampleRate: 1.0` in production**: this can be expensive and noisy. Start at 0.05-0.2 and adjust.
- **Initializing too late**: imports before `Sentry.init()` won't be auto-instrumented. Init at the very top of your entrypoint.
- **PII leakage**: `sendDefaultPii: true` ships emails, IPs, and headers. Leave it off unless you've reviewed your DPA.
- **Mixing environments**: forgetting to set `environment` means staging errors page your on-call.

## Security considerations

- **DSN**: the DSN is not a secret -- it's safe to ship to browsers. But Sentry auth tokens (used by `sentry-cli`) ARE secrets. Store `SENTRY_AUTH_TOKEN` in CI env vars only.
- **PII scrubbing**: enable server-side data scrubbing in Sentry project settings. Configure `beforeSend` to redact `password`, `token`, `authorization` headers, credit card numbers.
- **Source maps**: upload with `sentry-cli sourcemaps upload --no-rewrite` and consider `--validate`. Do not deploy source maps publicly with your JS bundles -- upload them privately to Sentry and strip the `//# sourceMappingURL=` comment in production builds.
- **Org/Project tokens**: use the minimum scopes (`project:releases` for CI upload).
- **Self-hosted DSN**: if running self-hosted Sentry, the DSN URL reveals your internal hostname. Front with a CDN or proxy if needed.

## Reference

- Official docs: https://docs.sentry.io
- Platform-specific SDKs: https://docs.sentry.io/platforms/
- Source maps: https://docs.sentry.io/platforms/javascript/sourcemaps/
- Releases: https://docs.sentry.io/product/releases/
- Related: [[opentelemetry-instrumentation]], [[langfuse-observability]]
