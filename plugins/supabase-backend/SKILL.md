---
name: supabase-backend
description: Build backends on Supabase (Postgres, Auth, Storage, Edge Functions, Realtime). Covers Row Level Security policies, the supabase-js client, realtime subscriptions, storage buckets, edge functions in Deno, and database migrations via the Supabase CLI. Use when designing RLS, wiring a frontend to Supabase, writing edge functions, managing migrations, or debugging auth and JWT claims.
---

# Supabase Backend

Practical guide to shipping a Supabase backend: Postgres with Row Level Security, GoTrue auth, Storage, Realtime, and Edge Functions. Focuses on the RLS patterns and CLI workflows that make Supabase usable in production rather than as a prototype.

## Use this skill when
- Designing Row Level Security policies for multi-tenant data
- Wiring a web or mobile client to Supabase with `@supabase/supabase-js`
- Writing Deno-based Edge Functions for server-side logic
- Managing schema with `supabase db diff` and migrations
- Configuring Storage buckets and signed URLs
- Subscribing to Realtime changes (Postgres CDC or broadcast)

## Do not use this skill when
- You need fine-grained control over Postgres extensions Supabase does not allow
- You are running self-hosted Postgres without Supabase services (use plain `postgresql` skill)
- Your workload needs server-side code in a language other than Deno (run a separate API)

## Core concepts
Supabase exposes Postgres through PostgREST (auto-generated REST API) and Realtime (logical replication). Auth issues a JWT whose `sub` claim is the user's UUID and whose `role` is `anon` or `authenticated`. Every API call runs as that role with the JWT available as `auth.jwt()` and the user id as `auth.uid()` inside SQL. **RLS is the security boundary**, not the client.

## Quick start
```bash
# CLI setup
npm i -g supabase
supabase init
supabase start          # local dev: Postgres, GoTrue, Storage, Studio on localhost
supabase migration new create_todos
# edit supabase/migrations/<timestamp>_create_todos.sql
supabase db reset       # apply migrations to local
supabase db push        # apply to linked remote project
```
```sql
-- supabase/migrations/20260101000000_create_todos.sql
create table public.todos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "owner can read" on public.todos
  for select to authenticated
  using (auth.uid() = user_id);

create policy "owner can insert" on public.todos
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "owner can update" on public.todos
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owner can delete" on public.todos
  for delete to authenticated
  using (auth.uid() = user_id);
```
```ts
// client
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data, error } = await supabase
  .from("todos")
  .select("id,title,done")
  .order("created_at", { ascending: false });
```

## Key patterns

### Row Level Security
RLS is off by default; turn it on for every table exposed via PostgREST. Without RLS, the `anon` and `authenticated` roles can read and write everything.
- `using` controls which rows are visible/affected (read, update, delete).
- `with check` controls which rows can be created/updated to.
- Policies are additive: a row is allowed if any policy permits it. Restrict by giving fewer policies, not by trying to write deny rules.

For multi-tenant joins, wrap subselects in a `security definer` SQL function and call as `(select is_member(team_id))` so Postgres caches the result per query rather than re-running it per row.

### Auth and JWT
```ts
await supabase.auth.signUp({ email, password });
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signInWithOAuth({ provider: "github" });
const { data: { user } } = await supabase.auth.getUser();
```
Inside SQL/RPC, read claims via `auth.uid()`, `auth.jwt() ->> 'email'`, `auth.role()`. Custom claims live under `auth.jwt() -> 'app_metadata'`.

### Realtime
```ts
const channel = supabase
  .channel("todos-feed")
  .on("postgres_changes",
    { event: "*", schema: "public", table: "todos", filter: `user_id=eq.${userId}` },
    (payload) => console.log(payload))
  .subscribe();
```
Enable replication on the table in the dashboard or via `alter publication supabase_realtime add table public.todos`. Realtime respects RLS for `postgres_changes`.

### Storage
```ts
await supabase.storage.from("avatars")
  .upload(`${userId}/profile.png`, file, { upsert: true });

const { data } = await supabase.storage.from("avatars")
  .createSignedUrl(`${userId}/profile.png`, 60);
```
Storage policies are RLS on the `storage.objects` table:
```sql
create policy "owner read avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
```

### Edge Functions (Deno)
```ts
// supabase/functions/hello/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );
  const { data, error } = await supabase.from("todos").select("count");
  return new Response(JSON.stringify({ data, error }), {
    headers: { "content-type": "application/json" }
  });
});
```
`supabase functions serve hello` for local, `supabase functions deploy hello` to ship, `supabase secrets set KEY=val` for env. Pass the caller's JWT through to inherit their RLS context; use the `service_role` key only for trusted server-side bypass.

### Migrations workflow
`supabase db diff -f add_column` generates a migration from local schema changes; `supabase db push` applies to the linked remote; `supabase db reset` rebuilds local from scratch. Never edit a migration after it has been applied to a shared environment; write a new one.

## Common pitfalls
- **RLS disabled in production**: the `anon` role can dump every row. Run `select tablename from pg_tables where schemaname='public' and rowsecurity = false;` and enable RLS everywhere.
- **`service_role` key in the browser**: it bypasses RLS. Use only on the server (Edge Functions, your backend). The `anon` key is the only safe client key.
- **Forgetting `with check`**: a user can `update` rows they own to set `user_id` to someone else. Always add a `with check` matching the `using` clause for `insert`/`update`.
- **RLS policy with subquery per row**: scans n times. Wrap in a `security definer` helper function and call as `(select fn(...))` so the planner runs it once.
- **Realtime not firing**: table not added to the `supabase_realtime` publication, or RLS blocks the subscriber from reading the row.
- **Storage policies forgotten**: turning the bucket "public" makes everything world-readable; tighten with policies on `storage.objects`.
- **Edge Function exceeds limits**: 50MB bundle, 150s wall-clock (varies by plan). Move heavy work to a queue or external worker.
- **Schema edited in Studio without migration**: drift between local and prod. Always go through `supabase db diff` or hand-written migrations.

## Reference
- Official docs: https://supabase.com/docs
- RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
- CLI reference: https://supabase.com/docs/reference/cli/introduction
