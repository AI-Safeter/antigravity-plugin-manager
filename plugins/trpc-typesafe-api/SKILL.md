---
name: trpc-typesafe-api
description: tRPC for end-to-end type-safe RPC between TypeScript client and server with no codegen. Use this skill when defining routers and procedures, validating inputs with Zod, adding context and middleware (auth, logging), wiring up the React Query integration, or choosing between query/mutation/subscription procedure types.
---

# tRPC Type-Safe RPC

tRPC lets a TypeScript client call server functions with full type inference for inputs and outputs, no schema files, and no code generation. The server exports a single `AppRouter` type, the client imports the type-only, and every procedure call is checked at compile time. It is a strong default when both ends are TypeScript in the same monorepo.

## Use this skill when

- Building a TS-only client + server with shared types in a monorepo
- Defining routers (`router`, `mergeRouters`) and procedures (`publicProcedure`, `protectedProcedure`)
- Validating inputs with Zod (`.input(z.object({...}))`) and shaping outputs with `.output(...)`
- Adding context (auth, db, logger) and middleware (`t.middleware`, `.use(...)`)
- Hooking into React Query via `@trpc/react-query` (`useQuery`, `useMutation`, `useInfiniteQuery`)
- Choosing query vs mutation vs subscription (`httpSubscriptionLink` or websockets)

## Do not use this skill when

- The API must be consumed by non-TS clients (mobile native, other languages) — use REST/OpenAPI or GraphQL
- You need a public, documented contract with versioning and external consumers
- You want runtime-introspectable schemas without compile-time tooling

## Core concepts

`initTRPC` creates a `t` object that exposes `router`, `procedure`, `middleware`. Procedures are composed by chaining `.input(zodSchema).query(({ input, ctx }) => ...)` or `.mutation(...)`. The server exports `type AppRouter = typeof appRouter`; clients import that type-only and get `trpc.user.byId.useQuery({ id: 1 })` with full inference. Transport is HTTP (`httpBatchLink`) or WebSocket (`wsLink`).

## Quick start

```ts
// server/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

type Ctx = { userId: string | null; db: DB };
const t = initTRPC.context<Ctx>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
export const router = t.router;

export const appRouter = router({
  user: router({
    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input, ctx }) => ctx.db.user.find(input.id)),
    update: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(({ input, ctx }) => ctx.db.user.update(ctx.userId, input)),
  }),
});
export type AppRouter = typeof appRouter;
```

```ts
// client/trpc.ts
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "../server/trpc";

export const trpc = createTRPCReact<AppRouter>();
export const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

// In a component:
const { data } = trpc.user.byId.useQuery({ id: 1 });
const update = trpc.user.update.useMutation();
```

## Key patterns

### Procedure types
- `.query(...)`: idempotent reads; cached by React Query, batched over HTTP GET.
- `.mutation(...)`: writes; not cached, batched over HTTP POST.
- `.subscription(...)`: long-lived; requires `wsLink` or `httpSubscriptionLink` (SSE) on the client.

### Context per request
```ts
// adapter (Next.js / Fastify / Express)
export async function createContext({ req }: { req: Request }): Promise<Ctx> {
  const userId = await verifyJwt(req.headers.get("authorization"));
  return { userId, db };
}
```

### Composing routers
- `mergeRouters(a, b)` flattens namespaces; prefer nesting with `router({ user: userRouter })` for clarity.
- Keep procedures small; share Zod schemas across procedures by exporting `const userIdInput = z.object({ id: z.number() })`.

### Error handling
- Throw `TRPCError` with a `code` from a fixed set (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`).
- Zod input failures become `BAD_REQUEST` with the parse error in `data.zodError`.
- Customize formatting with `errorFormatter` in `initTRPC...create({ errorFormatter })`.

### React Query integration
- Use `useUtils()` for invalidation: `await utils.user.byId.invalidate({ id })`.
- `setData` for optimistic updates inside `useMutation({ onMutate })`.
- Server-side prefetching with `createServerSideHelpers` + `dehydrate` for SSR/Next.

### Server-side caller (no HTTP)
```ts
const caller = appRouter.createCaller({ userId: "1", db });
const user = await caller.user.byId({ id: 1 });
```
Useful for tests and server-to-server calls.

## Common pitfalls

- Importing the router VALUE on the client instead of the type-only (`import type { AppRouter }`); pulls server code into the bundle.
- Forgetting `.input(z.something())` — the input is `unknown` and types degrade silently.
- Putting heavy I/O inside `createContext` for every request when most procedures do not need it; lazy-create the db handle.
- Returning class instances or `Date`s without configuring `transformer: superjson` on BOTH client and server; `Date` becomes a string.
- Calling `useQuery` conditionally; use `enabled: !!id` instead of an `if` to keep the hook order stable.
- Treating tRPC as a public API; there is no stable wire contract, so external consumers break on refactors.
- Mismatched versions of `@trpc/server` and `@trpc/client` between packages cause confusing inference failures.

## Reference
- Official docs: https://trpc.io/docs
- Related: [[hono-edge-framework]], [[fastify-nodejs]]
