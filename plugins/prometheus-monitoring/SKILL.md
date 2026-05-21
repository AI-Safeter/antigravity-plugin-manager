---
name: prometheus-monitoring
description: Design Prometheus-based monitoring. Covers PromQL fundamentals, scrape configuration, recording and alerting rules, Alertmanager routing, service discovery, exporters, the four metric types (counter, gauge, histogram, summary), and the RED and USE methods. Use when authoring scrape configs, writing PromQL queries or alert rules, instrumenting an application, or designing dashboards and SLOs.
---

# Prometheus Monitoring

Practical guide to Prometheus 2.x for metrics collection, querying, and alerting. Focuses on PromQL idioms, alert authoring, and the small set of design choices (label cardinality, metric type, scrape interval) that determine whether a Prometheus deployment scales or falls over.

## Use this skill when
- Writing `prometheus.yml` scrape jobs or service-discovery configs
- Authoring or debugging PromQL queries
- Defining recording rules and alerting rules in `*.rules.yml`
- Configuring Alertmanager routes, receivers, and inhibitions
- Instrumenting an app with counters, gauges, and histograms
- Designing dashboards or SLOs using RED (Rate, Errors, Duration) or USE (Utilization, Saturation, Errors)

## Do not use this skill when
- You need distributed tracing (use Jaeger/Tempo/OTel traces)
- You need log aggregation (use Loki/ELK)
- Your workload requires long-term high-cardinality storage at scale (consider Mimir/Thanos/VictoriaMetrics in addition)

## Core concepts
Prometheus pulls metrics over HTTP on a schedule from targets exposing a text format on `/metrics`. Each metric is `(name, label_set) -> float64 value at timestamp`. Storage is a TSDB on the local filesystem. Queries are pure PromQL over labeled time series. Alerts are PromQL expressions that, when truthy for a duration, fire to Alertmanager which de-dupes, groups, and routes.

## Quick start
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: node
    static_configs:
      - targets: ["node-exporter:9100"]

  - job_name: web
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

rule_files:
  - rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]
```

## Key patterns

### The four metric types
- **Counter**: monotonically increasing (resets to 0 on restart). Always query via `rate()` or `increase()`, never the raw value. Example: `http_requests_total`.
- **Gauge**: arbitrary up-and-down value. Query directly. Example: `process_resident_memory_bytes`.
- **Histogram**: pre-bucketed observations. Server-side computes quantiles with `histogram_quantile(0.95, sum by (le)(rate(http_request_duration_seconds_bucket[5m])))`.
- **Summary**: client-side quantiles. Cannot be aggregated across instances. Prefer histograms unless you have a strong reason.

### PromQL essentials
```promql
# Per-second rate over 5m windows
rate(http_requests_total[5m])

# Sum by label, dropping others
sum by (status) (rate(http_requests_total[5m]))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
sum(rate(http_requests_total[5m]))

# p95 latency from a histogram
histogram_quantile(0.95,
  sum by (le)(rate(http_request_duration_seconds_bucket[5m])))

# Top-k noisy endpoints
topk(5, sum by (route)(rate(http_requests_total[5m])))
```
Use `rate` for short-range graphs and alerts; `increase` for counts over a window. `irate` is for fast-moving graphs only.

### Recording rules
Precompute expensive queries; dashboards and alerts read the recorded series.
```yaml
groups:
  - name: web.rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job)(rate(http_requests_total[5m]))
      - record: job:http_errors:ratio5m
        expr: |
          sum by (job)(rate(http_requests_total{status=~"5.."}[5m]))
            /
          sum by (job)(rate(http_requests_total[5m]))
```

### Alerting rules
```yaml
- alert: HighErrorRate
  expr: job:http_errors:ratio5m{job="web"} > 0.02
  for: 10m
  labels: {severity: page, team: web}
  annotations:
    summary: "Web error rate > 2% (10m)"
    description: "{{ $value | humanizePercentage }} on {{ $labels.job }}"
```
`for:` requires the condition to hold for that long before firing; suppresses flaps.

### Alertmanager routing
```yaml
route:
  receiver: default
  group_by: [alertname, job]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers: [severity="page"]
      receiver: pagerduty
receivers:
  - name: default
    slack_configs: [{channel: "#alerts", api_url: "..."}]
  - name: pagerduty
    pagerduty_configs: [{service_key: "..."}]
inhibit_rules:
  - source_matchers: [severity="page"]
    target_matchers: [severity="ticket"]
    equal: [alertname, job]
```

### RED and USE methods
- **RED** for request-driven services: Rate, Errors, Duration. Three panels per service.
- **USE** for resources (CPU, disk, network): Utilization, Saturation, Errors.
Pick one per layer; do not mix.

### Service discovery and relabeling
Kubernetes, EC2, Consul, file SD all produce `__meta_*` labels. Use `relabel_configs` to keep, drop, and rename targets at scrape time. Use `metric_relabel_configs` to drop or rename series after scrape (for cardinality control).

### Exporters
Don't write metrics from scratch when an exporter exists: `node_exporter` (hosts), `blackbox_exporter` (probes), `postgres_exporter`, `kube-state-metrics`, `cAdvisor`. For your own apps, use the official client libraries (Go, Python, Java, Ruby, etc.).

## Common pitfalls
- **High-cardinality labels**: putting `user_id`, `request_id`, or unbounded `path` into labels explodes series count and crashes the TSDB. Keep label cardinality bounded; aggregate IDs out.
- **Counter without `rate`**: graphing `http_requests_total` directly shows a meaningless ever-growing line. Use `rate()` or `increase()`.
- **Mixing `rate` window with scrape interval**: `rate(x[1m])` with a 15s scrape gives noisy results; needs at least 4 samples. Use `[5m]` or wider for alerts.
- **`histogram_quantile` over non-aggregated buckets**: must `sum by (le)` first, then take the quantile. Reversing produces wrong numbers.
- **Alert firing on `absent()` without `for`**: a brief scrape failure pages you. Combine with `for: 5m`.
- **No `for:` on alerts**: every transient spike pages. Always set `for:` (typically 5-15m).
- **Single Prometheus for everything**: local TSDB caps at what one disk and one process can hold. Federate or use a long-term store (Thanos, Mimir, VictoriaMetrics) past ~1M active series.
- **Scrape interval too short**: 1s scrapes 60x the storage cost of 60s and rarely add value. 15-30s is typical.

## Reference
- Official docs: https://prometheus.io/docs/
- PromQL: https://prometheus.io/docs/prometheus/latest/querying/basics/
- Alerting best practices: https://prometheus.io/docs/practices/alerting/
