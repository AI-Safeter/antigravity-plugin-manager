---
name: prisma-orm
description: Model data and write type-safe queries with Prisma. Use for schema.prisma syntax, relations (1:1, 1:n, m:n), prisma generate vs prisma migrate dev, the Prisma Client API (findMany, create, upsert, transactions, $queryRaw), middleware/extensions, and soft-delete patterns.
---

# Prisma ORM

Prisma is a type-safe ORM for Node.js/TypeScript built around a declarative schema. The schema generates a strongly typed client; migrations are derived from schema diffs. Prisma is opinionated: it owns the schema, and ad-hoc DDL outside Prisma will bite you.

## Use this skill when

- Designing or modifying `schema.prisma`, including relations and indexes
- Generating the Prisma Client (`prisma generate`) or running migrations (`prisma migrate dev`, `migrate deploy`)
- Writing queries with `findMany`, `create`, `update`, `upsert`, `groupBy`, nested writes
- Wrapping work in interactive transactions (`prisma.$transaction([...])` or `$transaction(async (tx) => ...)`)
- Escaping to raw SQL via `$queryRaw` / `$executeRaw` (always parameterized)
- Adding cross-cutting behavior via Prisma Client Extensions (the modern replacement for middleware)

## Do not use this skill when

- You are not using Node.js/TypeScript
- You need a thin SQL builder rather than an opinionated schema owner (consider Kysely or Drizzle)
- You need raw control of every query plan and want no abstraction

## Core concepts

`schema.prisma` defines the datasource, generator, and models. Each model maps to a table. Relations are declared on both sides; one side holds the foreign key via `@relation(fields: [...], references: [...])`. `prisma migrate dev` diffs the schema against the shadow database and writes a SQL migration; `prisma generate` regenerates the typed client.

## Quick start

```prisma
// schema.prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id        BigInt   @id @default(autoincrement())
  email     String   @unique
  createdAt DateTime @default(now())
  orders    Order[]
}

model Order {
  id        BigInt      @id @default(autoincrement())
  userId    BigInt
  user      User        @relation(fields: [userId], references: [id])
  status    OrderStatus @default(PENDING)
  total     Decimal     @db.Decimal(10, 2)
  createdAt DateTime    @default(now())

  @@index([userId, createdAt])
}

enum OrderStatus { PENDING PAID CANCELED }
```

```ts
const recent = await prisma.order.findMany({
  where: { userId: 42n, status: 'PAID' },
  include: { user: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
```

## Key patterns

- One-to-many: child holds the FK (`userId`) and `user User @relation(...)`; parent has `orders Order[]`. Many-to-many: use an explicit join model when you need columns on the relation, otherwise the implicit `@relation` form is fine.
- Use `upsert` for idempotent writes keyed by a unique constraint. For bulk idempotent inserts, prefer `createMany({ skipDuplicates: true })` on Postgres/SQLite.
- Interactive transactions: pass an async callback to `prisma.$transaction` and use the transactional client `tx` for every call inside. Set `timeout` and `maxWait` explicitly for long flows.
- Use `select` to whitelist returned fields. Without it Prisma returns every scalar column. `include` adds relations; you can combine them but cannot mix `select` and `include` at the same level.
- Raw SQL: `prisma.$queryRaw\`SELECT ... WHERE id = ${id}\`` is parameterized via tagged template. Never use string concatenation with `$queryRawUnsafe`.
- Soft deletes: add `deletedAt DateTime?` and filter via a Prisma Client Extension (`$extends({ query: { $allModels: { findMany({ args, query }) { args.where = { ...args.where, deletedAt: null }; return query(args); } } } })`). The old middleware API (`$use`) is deprecated in v5+.
- Migrations: `prisma migrate dev` for local iteration, `prisma migrate deploy` in CI/production. Never edit applied migration SQL after it has been deployed.
- For very large schemas, enable `previewFeatures = ["prismaSchemaFolder"]` and split models across files under `prisma/schema/`.

## Common pitfalls

- Drifting the database with hand-written DDL outside Prisma. The next `migrate dev` will offer to reset the database. Always change the schema and migrate.
- Forgetting that `BigInt` does not serialize to JSON. Add a global `BigInt.prototype.toJSON = function(){ return this.toString(); }` or convert at the boundary.
- Using `findMany` without `take`. One bad query can return millions of rows. Default to bounded result sets.
- N+1 from looping `findUnique` instead of using `findMany({ where: { id: { in: ids } } })` or a single `include`.
- Long-running interactive transactions block a connection from the pool. Keep them short; for read-heavy work, do not wrap in a transaction at all.
- `connect_or_create` on a relation can issue extra queries. For hot paths use `upsert` directly on the related model with a unique key.
- The connection pool defaults are conservative. In serverless, use a pooler (PgBouncer, Prisma Accelerate, RDS Proxy) and set `?pgbouncer=true` in the URL to disable prepared statements.
- Treating `$queryRawUnsafe` as a convenience for dynamic SQL. It is an injection vector; build dynamic SQL with `Prisma.sql` and `Prisma.join` helpers.

## Reference

- Official docs: https://www.prisma.io/docs
- Schema reference: https://www.prisma.io/docs/orm/reference/prisma-schema-reference
- Client API: https://www.prisma.io/docs/orm/reference/prisma-client-reference
