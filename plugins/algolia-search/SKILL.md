---
name: algolia-search
description: Algolia hosted search-as-a-service for indexing, ranking, faceting, and search-as-you-type UIs. Use this skill when integrating Algolia indexing pipelines, configuring relevance and custom ranking, building InstantSearch React or Vue UIs, setting up replicas for sort orders, or using secured API keys for multi-tenant search.
---

# Algolia Search

Algolia is a hosted search API engineered for sub-50ms response times with typo tolerance, faceting, and customizable ranking out of the box. The mental model: push your data as JSON `records` into an `index`, configure `searchableAttributes` and `customRanking`, then query from the browser with InstantSearch widgets or directly via the search-only API key. Pay attention to index size and ops -- pricing is per record and per search.

## Use this skill when

- Adding product search, docs search, or content search to a site
- Building an instant-results UI (search-as-you-type)
- Needing typo tolerance, synonyms, and prefix matching out of the box
- Faceting on categories, brands, tags, price ranges
- Multi-language search with per-language indexes
- Multi-tenant SaaS where each tenant only sees their own records (Secured API keys)

## Do not use this skill when

- You need full-text search you can self-host (use Meilisearch or Typesense)
- You want vector / semantic search as the primary mode (use pgvector, Pinecone, Weaviate)
- Cost-per-record is prohibitive at your data volume

## Core concepts

A `record` is a JSON object with an `objectID`. An `index` is a collection of records with a configuration (searchable attrs, ranking). `Replicas` are alternate-sorted views of the same index (e.g., sorted by price asc). `Facets` are filterable/aggregatable attributes (`attributesForFaceting`). `Rules` apply business logic ("for query 'sale', boost items where promo=true"). Two API keys: `Admin` (server) and `Search-Only` (browser); `Secured API Keys` are signed restrictions of the search-only key.

## Quick start

```bash
npm install algoliasearch instantsearch.js react-instantsearch
# or for vanilla JS: npm install algoliasearch instantsearch.js
```

```typescript
// server: indexing
import { algoliasearch } from 'algoliasearch';
const client = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_API_KEY!);

await client.saveObjects({
  indexName: 'products',
  objects: [
    { objectID: 'sku_1', name: 'Wireless Headphones', brand: 'Acme', price: 99, tags: ['audio', 'bluetooth'] },
    { objectID: 'sku_2', name: 'USB-C Cable',         brand: 'Acme', price:  9, tags: ['cable'] },
  ],
});

await client.setSettings({
  indexName: 'products',
  indexSettings: {
    searchableAttributes: ['name', 'brand', 'tags'],
    attributesForFaceting: ['brand', 'tags', 'filterOnly(price)'],
    customRanking: ['desc(popularity)', 'asc(price)'],
  },
});
```

```tsx
// client: React InstantSearch
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { InstantSearch, SearchBox, Hits, RefinementList } from 'react-instantsearch';

const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!,
);

export default function Search() {
  return (
    <InstantSearch searchClient={searchClient} indexName="products">
      <SearchBox />
      <RefinementList attribute="brand" />
      <Hits hitComponent={({ hit }) => <div>{hit.name} -- ${hit.price}</div>} />
    </InstantSearch>
  );
}
```

## Key patterns

### Searchable attributes and ranking
`searchableAttributes` defines what gets matched and the priority order (earlier = more important). `customRanking` is the tiebreaker after textual relevance -- typically `desc(popularity)`, `desc(sales)`, etc. The full ranking is: textual > geo > filters > custom.

### Faceting
Declare in `attributesForFaceting`. Use `filterOnly(attr)` if you only filter (cheaper) vs full faceting (returns counts). Query with `filters: 'brand:Acme AND price < 50'` or `facetFilters: [['brand:Acme', 'brand:Sony']]`.

### Replicas for sort orders
Don't reindex for different sorts. Create replicas: `productsindex_price_asc`, `productsindex_price_desc`. Configure `customRanking` per replica. Switch via `indexName` in queries.

### Secured API keys (multi-tenant)
Generate per-user keys server-side that restrict by filter:
```typescript
const securedKey = client.generateSecuredApiKey({
  parentApiKey: process.env.ALGOLIA_SEARCH_KEY!,
  restrictions: { filters: `tenant_id:${userId}`, validUntil: Math.floor(Date.now() / 1000) + 3600 },
});
```
Ship `securedKey` to the browser. The user can't bypass the filter.

### Atomic reindex
For full rebuilds: index into `products_tmp`, then `client.operationIndex({ indexName: 'products_tmp', operation: 'move', destination: 'products' })`.

### Partial updates
`client.partialUpdateObject({ indexName, objectID, attributesToUpdate: { price: 89 } })` -- cheaper than re-saving the whole record.

## Common pitfalls

- **Shipping the admin API key to the browser**: catastrophic. The admin key can delete indexes. Use the search-only key (or a Secured API key) in the client.
- **Reindexing everything on every change**: use `partialUpdateObject` or batch updates. Each operation counts toward your quota.
- **Storing huge records**: there's a 10KB-per-record default soft limit (configurable up to 100KB). Strip HTML, truncate long descriptions, keep only what's searchable/displayable.
- **Not setting `searchableAttributes`**: by default every attribute is searched, which dilutes relevance and slows queries.
- **Forgetting `objectID`**: if you don't provide it, Algolia generates one and you can't update or delete by your business ID. Always set `objectID` explicitly.
- **Replicas drift out of sync**: settings changes don't auto-propagate unless you use standard replicas (vs virtual replicas). Reapply settings or use virtual replicas (paid feature) for auto-sync.
- **Mixing test and prod indexes**: prefix index names with env (`products_prod`, `products_staging`).

## Security considerations

- **API keys**: `ALGOLIA_ADMIN_API_KEY` is server-only; can create/delete indexes. `ALGOLIA_SEARCH_KEY` (search-only) is safe in browsers. Generate Secured API Keys per-user for tenant isolation.
- **Secured API keys**: signed with the parent search key -- the user cannot tamper with the filter. Always include `validUntil` for expiry.
- **Rate limiting**: search-only keys can be rate-limited per IP via `restrictSources` in Secured API keys.
- **Sensitive data**: don't index passwords, tokens, or PII you wouldn't surface in search results. Algolia stores records in cleartext.
- **GDPR**: Algolia is GDPR-compliant but data residency matters -- choose the right region (EU vs US clusters) when creating the app.
- **Analytics PII**: by default, Algolia logs raw queries for analytics. If queries can contain PII, disable analytics for those indexes.

## Reference

- Official docs: https://www.algolia.com/doc
- InstantSearch React: https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react/
- Ranking formula: https://www.algolia.com/doc/guides/managing-results/relevance-overview/in-depth/ranking-criteria/
- Secured API keys: https://www.algolia.com/doc/guides/security/api-keys/how-to/generate-secured-api-keys/
- Related: [[meilisearch]]
