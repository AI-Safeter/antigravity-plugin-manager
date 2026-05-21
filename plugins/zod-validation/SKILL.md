---
name: zod-validation
description: Zod TypeScript-first schema validation library. Use this skill when defining input validation, parsing untrusted data (API requests, form inputs, env vars, third-party JSON), generating static types from runtime schemas via z.infer, building discriminated unions, or integrating validation with react-hook-form. Triggers on z.object, z.infer, safeParse, schema.parse, .refine, .transform, ZodError, or any TypeScript validation/parsing task.
---

# Zod Validation

Zod is a TypeScript-first schema declaration and validation library. You write a schema once and get both runtime validation and a statically-inferred TypeScript type. It is the de-facto choice for validating API boundaries, form input, and configuration in modern TS projects.

## Use this skill when

- Validating untrusted input at any boundary: HTTP request bodies, query params, headers, env vars, third-party JSON
- Generating TypeScript types from a single source of truth (`z.infer<typeof Schema>`)
- Building form validation with `react-hook-form` via `@hookform/resolvers/zod`
- Defining tRPC, Hono, or Next.js route input schemas
- Parsing values returned from `JSON.parse`, `localStorage`, or LLM responses
- Modeling discriminated unions and tagged variants with runtime checks

## Do not use this skill when

- You only need compile-time types (use plain TypeScript interfaces)
- You need a class-based ORM-style model with methods (use Valibot for tree-shaking, or class-validator)
- You need extremely tiny bundle size and don't need transforms (Valibot is lighter)

## Core concepts

A `ZodSchema` is both a parser and a type. `parse` throws on invalid input; `safeParse` returns a discriminated union `{ success: true, data } | { success: false, error }`. `z.infer<typeof Schema>` extracts the static output type. Schemas compose: every method returns a new schema, never mutates.

## Quick start

```ts
import { z } from "zod";

const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().nonnegative().optional(),
  role: z.enum(["admin", "member", "guest"]),
  createdAt: z.coerce.date(),
});

type User = z.infer<typeof User>;

const result = User.safeParse(unknownInput);
if (!result.success) {
  console.error(result.error.flatten().fieldErrors);
  return;
}
const user: User = result.data; // fully typed and validated
```

## Key patterns

### safeParse vs parse
Prefer `safeParse` at trust boundaries so you can handle errors explicitly. Reserve `parse` for invariants you believe cannot fail (it throws `ZodError`).

### Inferring input vs output types
When using `.transform` or `.default`, input and output types diverge. Use `z.input<typeof S>` for what the user provides and `z.output<typeof S>` (same as `z.infer`) for what comes out.

### Discriminated unions
Faster and produce cleaner errors than plain `z.union`:
```ts
const Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("submit"), formId: z.string() }),
]);
```

### Refinements and transforms
Use `.refine` for custom validation, `.superRefine` when you need to add multiple issues, and `.transform` to reshape data after validation:
```ts
const Password = z.object({ pw: z.string(), confirm: z.string() })
  .refine((d) => d.pw === d.confirm, { message: "Passwords differ", path: ["confirm"] });

const Trimmed = z.string().transform((s) => s.trim().toLowerCase());
```

### Coercion for query strings and env vars
`z.coerce.number()`, `z.coerce.boolean()`, `z.coerce.date()` are essential for parsing strings into typed values. Note `z.coerce.boolean()` is JS-truthy, not "true"/"false" -- write a custom transform if you need string parsing.

### Composing schemas
Use `.partial()`, `.required()`, `.pick({...})`, `.omit({...})`, `.extend({...})`, `.merge(other)` to derive related shapes (e.g., `CreateUser`, `UpdateUser`, `PublicUser`).

### Async validation
`safeParseAsync` / `parseAsync` are required if any refinement or transform is async (e.g., checking email uniqueness against a DB).

## Common pitfalls

- **`z.string().email()` is permissive**: Zod's built-in email regex is intentionally lax. For stricter checks, add `.refine` or use a dedicated email validator.
- **Coerce-boolean surprises**: `z.coerce.boolean().parse("false")` returns `true` because `Boolean("false") === true`. Write `z.enum(["true","false"]).transform(v => v === "true")` instead.
- **Stripping unknown keys silently**: `z.object` strips by default. Use `.strict()` to reject unknown keys, or `.passthrough()` to keep them.
- **`parse` throwing in hot paths**: throwing is expensive. Use `safeParse` in loops or per-request handlers.
- **Discriminated union with non-literal discriminator**: the discriminator key must be a `z.literal` (or enum of literals) in every branch -- otherwise fall back to `z.union`.
- **Forgetting `z.infer` on the schema, not the value**: write `type T = z.infer<typeof Schema>`, not `typeof schema.parse(...)`.
- **Default vs optional**: `.optional()` makes a field `T | undefined`; `.default(v)` makes input optional but output always `T`. Pick deliberately.

## Reference

- Official docs: https://zod.dev
- Repo: https://github.com/colinhacks/zod
- Related: [[react-hook-form]] (via `@hookform/resolvers/zod`), [[typescript-advanced-types]] (for understanding `z.infer` magic), [[pydantic-v2]] (the Python analogue)
