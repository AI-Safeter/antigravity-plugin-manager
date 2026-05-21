---
name: redux-toolkit
description: Redux Toolkit (RTK) -- the official, opinionated way to write Redux. Use this skill when configuring a Redux store with configureStore, defining slices via createSlice (Immer-backed reducers), writing async logic with createAsyncThunk, building data-fetching endpoints with RTK Query (createApi, fetchBaseQuery), or migrating legacy Redux to RTK. Triggers on createSlice, configureStore, createAsyncThunk, createApi, RTK Query, useSelector, useDispatch, or any Redux task.
---

# Redux Toolkit

Redux Toolkit (RTK) is the official, batteries-included Redux package. It eliminates the boilerplate of hand-written action types, action creators, and reducers, ships with Immer (mutable-looking reducers), Redux Thunk, and includes RTK Query for data fetching. As of 2020, plain Redux is considered legacy -- new Redux code should use RTK.

## Use this skill when

- Setting up a Redux store in a new app (`configureStore`)
- Defining feature state with `createSlice` (replaces hand-written reducers + action creators)
- Writing async actions with `createAsyncThunk` for non-trivial flows
- Adding RTK Query for server-state caching as an alternative to TanStack Query inside a Redux app
- Migrating legacy Redux (manual action types, `combineReducers`, `redux-thunk` boilerplate) to modern patterns
- You need a strict, auditable global-state architecture across a large team

## Do not use this skill when

- The app is small enough that [[zustand-state]] would suffice (less ceremony)
- The state is purely server data and you're outside the Redux ecosystem (use [[tanstack-query]])
- You need fine-grained reactivity (consider Jotai, Recoil, or Signals)

## Core concepts

A **slice** is a reducer + auto-generated actions for one feature. `configureStore` wires slices together and adds the Redux DevTools, `redux-thunk`, and default middleware (immutability/serializability checks). Reducers in RTK appear to mutate state -- Immer produces an immutable next state under the hood. **RTK Query** is a separate API (`createApi`) that generates hooks (`useGetXQuery`, `useUpdateXMutation`) backed by the Redux store, providing caching, dedupe, invalidation, and polling.

## Quick start

```ts
// features/counter/counterSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    increment: (s) => { s.value += 1; },                       // Immer: looks mutable
    incrementBy: (s, a: PayloadAction<number>) => { s.value += a.payload; },
  },
});
export const { increment, incrementBy } = counterSlice.actions;
export default counterSlice.reducer;

// store.ts
import { configureStore } from "@reduxjs/toolkit";
import counter from "./features/counter/counterSlice";
export const store = configureStore({ reducer: { counter } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// In a component:
import { useSelector, useDispatch } from "react-redux";
const value = useSelector((s: RootState) => s.counter.value);
const dispatch = useDispatch<AppDispatch>();
dispatch(incrementBy(5));
```

## Key patterns

### Typed hooks
Define once, use everywhere:
```ts
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### createAsyncThunk
For async operations that update state on pending/fulfilled/rejected:
```ts
export const fetchUser = createAsyncThunk("user/fetch", async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return (await res.json()) as User;
});

const userSlice = createSlice({
  name: "user",
  initialState: { data: null, status: "idle" } as State,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUser.pending,   (s) => { s.status = "loading"; })
     .addCase(fetchUser.fulfilled, (s, a) => { s.status = "ok"; s.data = a.payload; })
     .addCase(fetchUser.rejected,  (s) => { s.status = "error"; });
  },
});
```

### RTK Query
```ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Todo"],
  endpoints: (b) => ({
    getTodos: b.query<Todo[], void>({ query: () => "todos", providesTags: ["Todo"] }),
    addTodo:  b.mutation<Todo, Partial<Todo>>({
      query: (body) => ({ url: "todos", method: "POST", body }),
      invalidatesTags: ["Todo"],
    }),
  }),
});
export const { useGetTodosQuery, useAddTodoMutation } = api;
```
Register `api.reducer` under `api.reducerPath` and add `api.middleware` to `configureStore`.

### Memoized selectors
For derived state, use `createSelector` from `reselect` (re-exported from RTK):
```ts
const selectTodos = (s: RootState) => s.todos.items;
export const selectDone = createSelector(selectTodos, (todos) => todos.filter(t => t.done));
```

### Listener middleware
`createListenerMiddleware` is the modern replacement for redux-saga in most cases -- react to dispatched actions without writing generators.

## Common pitfalls

- **Mutating state outside `createSlice`**: Immer only wraps reducers defined in `createSlice`. In plain selectors or thunks, you must not mutate state.
- **Returning a value AND mutating in a reducer**: pick one. Either mutate (`s.x = 1`) or return a new state (`return { ...s, x: 1 }`), never both -- Immer treats a non-undefined return value as the new state and ignores mutations.
- **Non-serializable values in state or actions**: by default RTK warns about Dates, Maps, class instances, Promises in actions. Either store them as serializable primitives or configure the `serializableCheck` middleware option.
- **Putting server state in slices manually**: re-implementing caching, dedupe, and invalidation by hand is a known anti-pattern. Use RTK Query or [[tanstack-query]] instead.
- **Reading store outside a component**: prefer `useSelector`. Direct `store.getState()` reads bypass subscriptions and skip re-renders.
- **One giant slice**: split by feature/domain. Slices are cheap.
- **Forgetting `extraReducers` for thunks**: the slice that owns the state must handle `pending/fulfilled/rejected` of an external thunk via `extraReducers`, not `reducers`.

## Reference

- Official docs: https://redux-toolkit.js.org
- RTK Query: https://redux-toolkit.js.org/rtk-query/overview
- Redux style guide: https://redux.js.org/style-guide/
- Related: [[zustand-state]] (lighter alternative), [[tanstack-query]] (server-state alternative to RTK Query)
