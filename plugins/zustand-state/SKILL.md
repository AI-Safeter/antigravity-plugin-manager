---
name: zustand-state
description: Zustand minimal client-state store for React. Use this skill when building a small-to-medium global store without Redux boilerplate, with create(), selector-based subscriptions, slices pattern, persist middleware (localStorage), immer middleware, devtools, subscribeWithSelector, or vanilla (non-React) stores. Triggers on zustand, create((set, get) =>), useStore, persist, immer middleware, slice pattern, or any lightweight global-state task.
---

# Zustand

Zustand is a tiny (~1KB) state management library for React (and vanilla JS) that exposes a single `create` function returning a hook. No provider, no actions/reducers boilerplate, no context -- you write a store as a plain function and components subscribe via selectors. It is the pragmatic default for client-side global state when Redux feels heavy.

## Use this skill when

- You need shared client state across unrelated components (theme, modals, sidebar, auth user)
- You want global state without Context provider trees or Redux boilerplate
- Persisting some state to localStorage/sessionStorage with the `persist` middleware
- Using Immer-style mutable updates via the `immer` middleware
- Building a non-React store (Node, vanilla JS) -- Zustand works without React
- Migrating off Context-as-store anti-pattern that causes excessive re-renders

## Do not use this skill when

- The state is server data (use [[tanstack-query]])
- You need time-travel debugging, middleware ecosystem, or strict action conventions across a large team (use [[redux-toolkit]])
- The state is purely local to one component (use `useState`/`useReducer`)

## Core concepts

`create` accepts a setter function and returns a custom hook. The hook takes a **selector** -- components only re-render when the selected slice changes (referential equality by default, customizable). State updates are shallow-merged by default at the top level (unlike `useState`), so `set({ count: 1 })` keeps other keys intact. There is no provider; the store is a module-level singleton.

## Quick start

```ts
import { create } from "zustand";

interface BearState {
  bears: number;
  increase: (by: number) => void;
  reset: () => void;
}

export const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((s) => ({ bears: s.bears + by })),
  reset: () => set({ bears: 0 }),
}));

// In a component:
function Counter() {
  const bears = useBearStore((s) => s.bears);          // re-renders only when bears changes
  const increase = useBearStore((s) => s.increase);    // stable function ref
  return <button onClick={() => increase(1)}>{bears}</button>;
}
```

## Key patterns

### Selectors for re-render control
Always select the minimal slice you use. Selecting the whole store (`useStore()`) re-renders on every change.
```ts
const name = useStore((s) => s.user.name);                    // good
const { user } = useStore((s) => ({ user: s.user }), shallow); // multiple fields: pair with shallow
```
Import `shallow` from `zustand/shallow` (v5: `useShallow`) when selecting multiple fields as an object/array.

### Slices pattern for larger stores
Split the store into composable slices:
```ts
const createBearSlice = (set) => ({ bears: 0, addBear: () => set((s) => ({ bears: s.bears + 1 })) });
const createFishSlice = (set) => ({ fishes: 0, addFish: () => set((s) => ({ fishes: s.fishes + 1 })) });
export const useStore = create((...a) => ({ ...createBearSlice(...a), ...createFishSlice(...a) }));
```

### Persist middleware
```ts
import { persist, createJSONStorage } from "zustand/middleware";
export const useAuth = create(persist(
  (set) => ({ token: null, setToken: (t) => set({ token: t }) }),
  { name: "auth", storage: createJSONStorage(() => localStorage) }
));
```
Provide a `version` and `migrate` function when the shape changes.

### Immer middleware for nested updates
```ts
import { immer } from "zustand/middleware/immer";
const useStore = create(immer((set) => ({
  todos: [],
  toggle: (id) => set((s) => { const t = s.todos.find(t => t.id === id); if (t) t.done = !t.done; }),
})));
```

### Devtools
```ts
import { devtools } from "zustand/middleware";
create(devtools((set) => ({ ... }), { name: "MyStore" }));
```

### Reading state outside React
`useStore.getState()` and `useStore.setState()` work anywhere -- handy for event handlers, route loaders, or non-React code.

### Subscribing imperatively
`useStore.subscribe(listener)` for side effects. Use `subscribeWithSelector` middleware to subscribe to a slice with equality checks.

## Common pitfalls

- **No selector**: `const all = useStore()` re-renders on any change. Always pass a selector.
- **Selecting a new object/array each render**: `useStore((s) => ({ a: s.a, b: s.b }))` returns a new object every time -> infinite re-renders. Pair with `shallow` (v4) or `useShallow` (v5).
- **Shallow merge is top-level only**: `set({ user: { name: "x" } })` replaces the entire `user` object. Spread manually: `set((s) => ({ user: { ...s.user, name: "x" } }))`, or use `immer`.
- **Putting server state in Zustand**: leads to manual cache invalidation and stale data. Use [[tanstack-query]] for server state.
- **SSR + persist hydration**: `persist` reads localStorage on mount, which doesn't exist during SSR. Use `skipHydration: true` and call `useStore.persist.rehydrate()` on the client, or gate UI on `_hasHydrated`.
- **Recreating the store in a component**: `create` belongs at module scope, not inside a component, unless you intentionally use the per-instance store factory pattern with React Context.
- **Forgetting `()` after `create<T>`**: the curried form `create<T>()(initializer)` is required for correct TS inference; `create<T>(initializer)` loses middleware typing.

## Reference

- Official docs: https://zustand.docs.pmnd.rs
- Repo: https://github.com/pmndrs/zustand
- Related: [[redux-toolkit]] (heavier alternative with strict patterns), [[tanstack-query]] (for server state, pair with Zustand for client state)
