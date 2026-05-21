---
name: tanstack-query
description: TanStack Query (formerly React Query) for async server-state management. Use this skill when fetching, caching, synchronizing, or mutating remote data in React/Vue/Solid/Svelte apps. Covers useQuery, useMutation, query keys, staleTime/gcTime, query invalidation, infinite queries, optimistic updates, suspense mode, and prefetching. Triggers on useQuery, useMutation, queryClient, queryKey, invalidateQueries, useInfiniteQuery, or any data-fetching/caching task.
---

# TanStack Query

TanStack Query (v5+) manages async server state -- fetching, caching, deduping, background refetching, mutation, and invalidation -- so you don't reinvent it on top of `useEffect`. It is the standard solution for talking to REST/GraphQL/RPC APIs from React (and now Vue, Solid, Svelte, Angular).

## Use this skill when

- Fetching data from a REST or GraphQL endpoint in a React component
- Caching responses across components and routes to avoid duplicate requests
- Implementing pagination or infinite scrolling with `useInfiniteQuery`
- Performing mutations (POST/PUT/DELETE) with optimistic updates and cache invalidation
- Prefetching data in loaders, route handlers, or on hover
- Adding background refetch on window focus / network reconnect

## Do not use this skill when

- The state is purely client-side (use [[zustand-state]] or `useState`)
- You need a normalized cache with strong relational integrity (consider Apollo Client or Relay for GraphQL)
- You're on Next.js App Router and Server Components alone meet your needs (use Server Components for read-only data, TanStack Query for client interactions)

## Core concepts

A **query** is a declarative subscription to async data, identified by a serializable `queryKey`. The query cache dedupes concurrent fetches with the same key. `staleTime` controls how long data is considered fresh (no auto-refetch); `gcTime` (formerly `cacheTime`) controls how long inactive data stays in memory. Mutations don't auto-update the cache -- you call `queryClient.invalidateQueries({ queryKey })` or `setQueryData` yourself.

## Quick start

```tsx
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function App() {
  return <QueryClientProvider client={qc}><Todos /></QueryClientProvider>;
}

function Todos() {
  const { data, isPending, error } = useQuery({
    queryKey: ["todos"],
    queryFn: () => fetch("/api/todos").then(r => r.json()),
  });

  const add = useMutation({
    mutationFn: (text: string) => fetch("/api/todos", { method: "POST", body: text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  if (isPending) return <p>Loading</p>;
  if (error) return <p>Error</p>;
  return <ul>{data.map(t => <li key={t.id}>{t.text}</li>)}</ul>;
}
```

## Key patterns

### Hierarchical query keys
Treat keys as URL paths: `["todos"]`, `["todos", todoId]`, `["todos", { status: "done" }]`. Invalidating `["todos"]` invalidates every key starting with it. Centralize keys in a `queryKeys` factory to avoid typos.

### staleTime vs gcTime
- `staleTime: 0` (default) -- refetches on mount/focus/reconnect. Aggressive freshness.
- `staleTime: Infinity` -- never auto-refetches; only manual invalidation updates it.
- `gcTime: 5 * 60_000` (default) -- inactive data evicted after 5 min.
Set `staleTime` per-query based on how often the underlying data changes.

### Mutations + invalidation
```ts
const mutation = useMutation({
  mutationFn: updateTodo,
  onSuccess: (_, vars) => {
    qc.invalidateQueries({ queryKey: ["todos"] });
    qc.invalidateQueries({ queryKey: ["todo", vars.id] });
  },
});
```

### Optimistic updates
```ts
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await qc.cancelQueries({ queryKey: ["todos"] });
    const previous = qc.getQueryData(["todos"]);
    qc.setQueryData(["todos"], (old) => old.map(t => t.id === newTodo.id ? newTodo : t));
    return { previous };
  },
  onError: (_e, _v, ctx) => qc.setQueryData(["todos"], ctx.previous),
  onSettled: () => qc.invalidateQueries({ queryKey: ["todos"] }),
});
```

### Infinite queries
```ts
const q = useInfiniteQuery({
  queryKey: ["feed"],
  queryFn: ({ pageParam }) => fetchPage(pageParam),
  initialPageParam: 0,
  getNextPageParam: (last) => last.nextCursor,
});
```

### Prefetching
`qc.prefetchQuery({ queryKey, queryFn })` on hover, route enter, or in a loader keeps perceived latency near zero.

### Suspense mode
Use `useSuspenseQuery` to integrate with React Suspense + error boundaries -- `data` is never `undefined`, simplifying types.

## Common pitfalls

- **Unstable query keys**: passing a new object literal in deps (`["user", { id }]` re-created each render) is fine because keys are deeply compared, but functions or class instances inside keys break dedup. Keep keys to plain serializable values.
- **`useEffect` to refetch**: don't. Use `enabled`, `refetchInterval`, or `invalidateQueries` instead.
- **Mutating without invalidating**: after a successful mutation, stale list views don't update unless you invalidate or `setQueryData`.
- **`isLoading` vs `isPending` confusion (v5)**: v5 renamed `isLoading` -> `isPending`. `isLoading` now means "pending AND fetching" -- only true on first load.
- **Forgetting `enabled`**: dependent queries that need an id should set `enabled: !!id` to defer fetching.
- **Putting server data into useState**: defeats the cache. Read from `useQuery` directly; derive locally only if necessary.
- **Global `staleTime: Infinity`**: convenient for demos, dangerous in prod -- data never refreshes without manual invalidation.

## Reference

- Official docs: https://tanstack.com/query/latest
- v4->v5 migration: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5
- Related: [[react-hook-form]] (use `useMutation` for form submission), [[zustand-state]] (for client-only state), [[zod-validation]] (validate API responses inside `queryFn`)
