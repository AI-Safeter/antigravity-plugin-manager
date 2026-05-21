---
name: meilisearch
description: Meilisearch open-source search engine for fast, typo-tolerant search. Use this skill when self-hosting Meilisearch or using Meilisearch Cloud, defining indexes and documents, configuring filterable and sortable attributes, tuning ranking rules, building search-as-you-type UIs, or comparing against Algolia and Typesense.
---

# Meilisearch

Meilisearch is an open-source, Rust-based search engine that ships sub-50ms search-as-you-type out of the box. It's the most common self-hostable alternative to Algolia: one binary, a REST API, and SDKs in every major language. The defaults are sensible (typo tolerance on, prefix search on), and you only need to tune ranking rules and filterable attributes for most apps.

## Use this skill when

- Adding instant search to a product without paying per-record
- Self-hosting search behind a private network
- Building search-as-you-type with `instant-meilisearch` or React InstantSearch
- Indexing documents, products, blog posts, or logs
- Needing filters, facets, and sorting without Algolia pricing
- Migrating off Algolia or Elasticsearch for cost or operational reasons

## Do not use this skill when

- You need full-text analytics over logs (use Elasticsearch / OpenSearch)
- You need pure vector search at scale (use Qdrant, Weaviate, Pinecone; Meilisearch hybrid search exists but is newer)
- You want zero-ops hosted search with a global edge (Algolia may fit better)

## Core concepts

A `document` is a JSON object with a `primary key` (usually `id`). An `index` holds documents and has its own settings (`searchableAttributes`, `filterableAttributes`, `sortableAttributes`, `rankingRules`). The default ranking is: words > typo > proximity > attribute > sort > exactness. Tasks (indexing, settings changes) are async and identified by a `taskUid`.

## Quick start

```bash
# Self-host with Docker
docker run -p 7700:7700 -v $(pwd)/meili_data:/meili_data \
  -e MEILI_MASTER_KEY='aSampleMasterKey' \
  getmeili/meilisearch:v1.10
```

```bash
npm install meilisearch
# Python: pip install meilisearch
# Go:     go get github.com/meilisearch/meilisearch-go
```

```typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: process.env.MEILI_HOST ?? 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY!,
});

// Add documents (creates index if absent)
const task = await client.index('products').addDocuments([
  { id: 1, name: 'Wireless Headphones', brand: 'Acme', price: 99, in_stock: true },
  { id: 2, name: 'USB-C Cable',         brand: 'Acme', price:  9, in_stock: true },
]);

// Configure
await client.index('products').updateSettings({
  searchableAttributes: ['name', 'brand'],
  filterableAttributes: ['brand', 'in_stock', 'price'],
  sortableAttributes: ['price'],
});

// Search
const results = await client.index('products').search('headphone', {
  filter: 'brand = "Acme" AND in_stock = true',
  sort: ['price:asc'],
  limit: 20,
});
```

## Key patterns

### Filters and facets
Declare `filterableAttributes` first. Query with `filter: 'price < 50 AND brand IN ["Acme", "Sony"]'`. For facet counts, pass `facets: ['brand']` and read `facetDistribution`.

### Sorting
Add to `sortableAttributes`, then `sort: ['price:asc', 'createdAt:desc']`. Without configuration, sort fields are ignored.

### Typo tolerance
On by default: 1 typo allowed at 5+ chars, 2 at 9+. Configure per attribute or globally:
```json
{ "typoTolerance": { "minWordSizeForTypos": { "oneTypo": 4, "twoTypos": 8 }, "disableOnAttributes": ["sku"] } }
```
Disable on exact-match fields like SKUs.

### Custom ranking
Default rules: `["words", "typo", "proximity", "attribute", "sort", "exactness"]`. Add custom rules like `popularity:desc` after `sort` to bias by a numeric attribute.

### Multi-search and federated search
Send one request that queries multiple indexes:
```typescript
await client.multiSearch({ queries: [
  { indexUid: 'products', q: 'shoe' },
  { indexUid: 'articles', q: 'shoe' },
]});
```

### Tenant tokens (multi-tenant)
Generate short-lived JWTs that restrict by filter -- equivalent to Algolia's secured API keys:
```typescript
const tenantToken = client.generateTenantToken({
  apiKey: process.env.MEILI_SEARCH_API_KEY!,
  searchRules: { products: { filter: `owner = ${userId}` } },
  expiresAt: new Date(Date.now() + 3600e3),
});
```

### Self-host vs Meilisearch Cloud
- **Self-host**: one binary or Docker image, store on a persistent volume. Backup via snapshots (`--schedule-snapshot 86400`).
- **Cloud**: managed, regional, with analytics dashboards. Same API. Choose for less ops overhead.

## Common pitfalls

- **Forgetting `filterableAttributes`**: searches with `filter:` silently fail (return error). Set settings before relying on filters.
- **No master key in production**: without `MEILI_MASTER_KEY` Meilisearch starts in "no auth" mode and warns; in production this exposes admin endpoints publicly.
- **Master key vs API keys**: use the master key only to bootstrap. Create scoped API keys (`search`, `documents.add`) for clients.
- **Indexing huge documents**: hard limit is 2 MB per document. Strip HTML, omit binary blobs.
- **Treating tasks as synchronous**: `addDocuments` returns immediately with a `taskUid`. Poll `client.tasks.getTask(uid)` if you need to know when indexing completed (tests, atomic swaps).
- **Reindexing instead of partial update**: `updateDocuments` merges by primary key; only re-send changed fields. Saves bandwidth and indexing time.
- **Missing primary key**: if no field is named `id`/`uid`/`...id`, Meilisearch tries to auto-detect on first add. Be explicit with `addDocuments(docs, { primaryKey: 'sku' })`.

## Security considerations

- **Master key**: `MEILI_MASTER_KEY` is the root credential -- grants full admin access. Store in env or secret manager, never commit. Rotate by setting a new one and restarting (existing API keys remain valid).
- **API keys**: create scoped keys with `client.createKey({ actions: ['search'], indexes: ['products'], expiresAt })`. Ship the search-only key to clients, never the master key.
- **Tenant tokens**: prefer over raw API keys for browser usage. They expire and embed per-user filters.
- **Network exposure**: by default Meilisearch binds `0.0.0.0:7700`. In production put it behind a reverse proxy or restrict to a private network -- never expose port 7700 publicly without auth and TLS.
- **TLS**: Meilisearch does not terminate TLS itself. Run behind nginx, Caddy, or use Meilisearch Cloud (HTTPS by default).
- **Backups**: enable snapshots (`--schedule-snapshot`) and offsite-copy them. Master key is required to restore.
- **Analytics**: Meilisearch sends anonymous telemetry by default. Disable with `--no-analytics` or `MEILI_NO_ANALYTICS=true` if your compliance regime requires.

## Reference

- Official docs: https://www.meilisearch.com/docs
- Settings: https://www.meilisearch.com/docs/reference/api/settings
- Tenant tokens: https://www.meilisearch.com/docs/learn/security/tenant_tokens
- InstantSearch integration: https://github.com/meilisearch/instant-meilisearch
- Related: [[algolia-search]]
