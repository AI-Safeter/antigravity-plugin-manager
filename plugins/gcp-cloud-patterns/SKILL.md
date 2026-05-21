---
name: gcp-cloud-patterns
description: Google Cloud patterns covering IAM, Cloud Run, Cloud Functions, Cloud Storage, Pub/Sub, BigQuery, Firestore, and Cloud Build. Use when designing or reviewing GCP architectures, debugging permission errors, picking between Cloud Run and GKE, modeling BigQuery tables, or untangling project vs organization permissions.
---

# GCP Cloud Patterns

Practical guidance for Google Cloud: how IAM actually composes across the resource hierarchy, when Cloud Run is the right answer (almost always), how to design BigQuery so it stays cheap, and the gotchas that bite teams coming from AWS.

## Use this skill when

- Designing IAM for service accounts, including impersonation and Workload Identity Federation
- Choosing between Cloud Run, Cloud Run jobs, Cloud Functions, GKE, and App Engine
- Modeling BigQuery tables (partitioning, clustering, slot reservations)
- Setting up Pub/Sub topics, subscriptions, and dead-letter handling
- Picking Firestore vs Cloud SQL vs Spanner for a workload
- Wiring CI with Cloud Build, Artifact Registry, and Cloud Deploy
- Debugging "permission denied" errors that span project and org levels

## Do not use this skill when

- You need vendor-neutral cloud architecture advice
- The question is AWS- or Azure-specific
- You only need a `gcloud` command without architectural context

## Core concepts

- **Resource hierarchy**: Organization -> Folders -> Projects -> Resources. IAM policies set at any level are inherited downward and are additive; you cannot subtract permissions further down. Only deny policies can subtract.
- **Principals**: Google accounts, Google groups, service accounts, domains, and federated identities. Service accounts are both an identity (you grant it roles) and a resource (you grant principals the right to use it via `iam.serviceAccountUser` or `iam.serviceAccountTokenCreator`).
- **Roles**: Basic (Owner, Editor, Viewer - avoid in production), Predefined (per service, what you usually want), Custom (only when no predefined role fits).
- **Project vs org permissions**: Many APIs require permissions at the project level (e.g., `roles/run.invoker` on the Cloud Run service) but billing, org policy, and folder management require org-level roles. Granting Owner on a project does not let someone change billing.
- **Regions and zones**: Multi-region (`us`, `eu`) for Cloud Storage and BigQuery; regional for Cloud Run, Cloud SQL, GKE; zonal for some compute. Picking the wrong location for BigQuery datasets later requires copying data.

## Quick start

```bash
# Auth as a user
gcloud auth login
gcloud config set project my-project

# Impersonate a service account (preferred over downloading keys)
gcloud auth application-default login --impersonate-service-account=deploy@my-project.iam.gserviceaccount.com

# Deploy a Cloud Run service from source
gcloud run deploy api --source . --region us-central1 --allow-unauthenticated

# Stream logs
gcloud run services logs tail api --region us-central1

# Run a BigQuery query
bq query --use_legacy_sql=false 'SELECT COUNT(*) FROM `proj.dataset.events` WHERE _PARTITIONDATE = CURRENT_DATE()'
```

## Key patterns

### IAM and service accounts

- Use predefined roles, not basic roles. `Editor` grants more than you think (impersonation, key creation on most service accounts).
- Avoid service account JSON keys. Prefer Workload Identity Federation (GitHub Actions, GitLab, AWS, OIDC) or impersonation from a human identity. If you must use keys, rotate aggressively and store in Secret Manager.
- IAM Conditions let you scope a binding by resource name, time, or request attributes: `resource.name.startsWith('projects/_/buckets/public-')`.
- Deny policies (on the organization or folder) override allow policies and are the right tool for guardrails like "no one can delete logs sinks."
- The "Service Account User" role is what lets a principal deploy code that runs *as* a service account. Grant it on the service account resource, not project-wide.

### Cloud Run

- Default choice for HTTP services and most async workloads. Scales to zero, pay-per-request, supports any container.
- **Concurrency**: default 80 simultaneous requests per instance. Lower it (1-10) for CPU-bound work, raise it (up to 1000) for I/O-bound. This is the single biggest performance and cost lever.
- **Min instances**: set to 1+ when cold start latency matters. CPU is throttled outside of requests unless you set "CPU always allocated" (needed for background work and gRPC streaming).
- **Cloud Run jobs** for finite batch work; **Cloud Run services** for request-driven traffic.
- Use a dedicated runtime service account per service. Grant it only the roles it needs.
- For internal-only services, set ingress to `internal` and require authenticated invocations.

### Cloud Functions (gen2)

- Gen2 Cloud Functions are Cloud Run services under the hood with extra glue for event triggers (Pub/Sub, Cloud Storage, Eventarc). For HTTP, you usually want Cloud Run directly.
- Gen1 is in maintenance mode; do not start new work there.
- Function code, runtime, and dependencies are built by Cloud Build into a container image stored in Artifact Registry.

### Cloud Storage

- Buckets are globally namespaced. Pick the location carefully (region, dual-region, multi-region) - moving data later means copying.
- Storage classes: Standard, Nearline (30d min), Coldline (90d min), Archive (365d min). Lifecycle rules transition objects automatically.
- Uniform bucket-level access disables per-object ACLs and is the modern default. Keep it on.
- Signed URLs for time-limited download or upload. V4 signing is the current standard. For browser uploads, signed URLs with `PUT` or resumable upload sessions.
- Object versioning + lifecycle rules give you cheap point-in-time recovery for important buckets.

### Pub/Sub

- Topic-subscription model with at-least-once delivery by default. Exactly-once delivery is opt-in per subscription and adds latency.
- Push subscriptions deliver to an HTTPS endpoint (typically Cloud Run); pull subscriptions let the consumer fetch. Push is simpler; pull scales better for high throughput and gives backpressure.
- Always configure a dead-letter topic and a sensible `maxDeliveryAttempts` (e.g., 5). Without it, a poison message retries forever.
- Ordering keys preserve order per key but reduce throughput and require an ordered subscription.
- Schemas (Avro or Protobuf) attached to topics catch shape drift at publish time.

### BigQuery

- **Partition** every large table, typically by ingestion time or an event timestamp column. Queries that filter on the partition column scan only relevant partitions, capping cost.
- **Cluster** on the columns you filter or join on after partitioning (up to 4). Clustering is free and dramatically reduces bytes scanned.
- Pricing models: on-demand (per TB scanned) vs editions (Standard/Enterprise/Plus slots, autoscaling). Switch to editions when monthly on-demand bills exceed roughly $2k or when query latency matters more than per-query cost.
- Use `SELECT` with explicit columns; `SELECT *` on wide tables is the number-one cost sink.
- Materialized views and BI Engine accelerate dashboards. Scheduled queries materialize incremental rollups cheaply.
- For streaming inserts, prefer the Storage Write API over the legacy `tabledata.insertAll` - cheaper, exactly-once with stream offsets, and required for new work.
- Authorized views and column-level / row-level access control replace per-table copies for sharing.

### Firestore

- Two modes: Native (document, real-time listeners, mobile SDKs) and Datastore (legacy). Choose Native for new work.
- Queries require composite indexes for multi-field filters and ordering. Firestore auto-suggests the index when a query fails - accept and commit those to your `firestore.indexes.json`.
- Reads, writes, deletes are all billed per operation. Listening to a collection with 10k docs charges for 10k reads on initial sync.
- No joins. Denormalize or fan out writes. For relational data with strong consistency across rows, use Cloud SQL or Spanner.
- Security rules run on every request from mobile/web SDKs. Server SDKs bypass rules - your service account is fully trusted.

### Cloud Build and Artifact Registry

- Cloud Build runs `cloudbuild.yaml` steps as containers; outputs go to Artifact Registry (Docker, Maven, npm, Python repos).
- Trigger from a GitHub or Cloud Source Repositories push. For PR builds, use a separate trigger with a non-prod service account.
- Builds run as the Cloud Build service account by default; for least privilege, attach a custom service account per pipeline.
- Cloud Deploy adds progressive delivery (rollouts, approvals, canary) on top of GKE and Cloud Run targets.

## Common pitfalls

- Granting `roles/editor` because "it works." This includes the ability to mint tokens for most service accounts in the project and is effectively project admin.
- Downloading service account keys for CI. Workload Identity Federation eliminates the key entirely; the key was probably your single biggest credential risk.
- Querying BigQuery with `SELECT *` against an unpartitioned table. One developer can burn a four-figure bill in an afternoon. Set `--maximum_bytes_billed` and per-project query quotas as a safety net.
- Picking the wrong BigQuery dataset location. You cannot move data between regions/multi-regions in place; you must copy.
- Cloud Run "CPU is only allocated during request processing" gotcha. Background work, gRPC streams, and async tasks need "CPU always allocated" or they will be throttled to near-zero between requests.
- Pub/Sub push subscriptions to a Cloud Run service without `roles/run.invoker` on the Pub/Sub service account, then debugging "permission denied" for an hour.
- Mixing project-level and folder-level IAM and being surprised that a folder grant gives a user access to every project in the folder.
- Forgetting that Firestore Security Rules don't apply to server SDKs; treating them as the only line of defense.

## Reference

- IAM policy hierarchy and Conditions: cloud.google.com/iam/docs/resource-hierarchy-access-control
- Cloud Run concurrency and scaling: cloud.google.com/run/docs/configuring/concurrency
- BigQuery best practices for cost: cloud.google.com/bigquery/docs/best-practices-costs
- Workload Identity Federation for CI: cloud.google.com/iam/docs/workload-identity-federation
- Pricing calculator: cloud.google.com/products/calculator
