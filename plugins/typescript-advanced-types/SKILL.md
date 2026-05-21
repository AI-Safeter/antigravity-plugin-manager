---
name: typescript-advanced-types
description: TypeScript advanced type patterns and type-level programming. Use this skill when working with conditional types, mapped types, template literal types, infer, satisfies, branded/nominal types, recursive types, variance, key remapping, distributive conditionals, or building library-grade generic APIs. Triggers on extends ? :, infer, keyof, typeof, satisfies, as const, Mapped types, Template literal types, brand types, or any non-trivial TypeScript type work.
---

# TypeScript Advanced Types

TypeScript's type system is structural, gradual, and powerful enough to encode many domain invariants at compile time. This skill covers the patterns you reach for when writing library code, schema-derived types (e.g., Zod, Drizzle), or when plain interfaces stop being expressive enough.

## Use this skill when

- Designing a generic API where return types depend on argument types
- Deriving one type from another (`Pick`, `Omit`, custom mapped types, key remapping)
- Parsing strings at the type level (route params, SQL-like APIs) with template literal types
- Modeling nominal/branded types to prevent unit-mixing bugs (UserId vs OrderId)
- Reading a type from runtime data using `typeof`, `as const`, and `satisfies`
- Building or consuming libraries like Zod, Drizzle, tRPC, or React Hook Form where types flow from values

## Do not use this skill when

- A plain `interface` or `type` alias solves the problem (don't over-engineer)
- You need runtime checks -- types are erased; pair with [[zod-validation]] or [[pydantic-v2]]
- You're hitting "Type instantiation is excessively deep" -- back off and simplify

## Core concepts

TypeScript's type system has a small set of composable operators: `keyof`, `typeof`, indexed access (`T[K]`), conditional (`T extends U ? A : B`), mapped (`{ [K in keyof T]: ... }`), and template literals (`` `${T}` ``). `infer` extracts a type inside a conditional. `satisfies` checks a value matches a type without widening it. `as const` narrows a value to its literal types. Together these enable type-level programming -- computation that runs at compile time.

## Quick start

```ts
// Derive a type from a runtime constant
const ROLES = ["admin", "member", "guest"] as const;
type Role = typeof ROLES[number]; // "admin" | "member" | "guest"

// Conditional + infer to extract a function's return type
type ReturnOf<F> = F extends (...a: any[]) => infer R ? R : never;
type R = ReturnOf<() => string>; // string

// Branded type for compile-time identity safety
type UserId = string & { readonly __brand: "UserId" };
const asUserId = (s: string) => s as UserId;
```

## Key patterns

### Conditional types and distribution
`T extends U ? A : B`. When `T` is a naked type parameter and a union, the conditional distributes:
```ts
type NonNull<T> = T extends null | undefined ? never : T;
type X = NonNull<string | null>; // string
```
Wrap in a tuple to prevent distribution: `[T] extends [U] ? ...`.

### `infer` for extraction
Pattern-match inside a conditional:
```ts
type First<T extends readonly any[]> = T extends readonly [infer F, ...any[]] ? F : never;
type Promised<T> = T extends Promise<infer U> ? U : T;
type Params<F> = F extends (...a: infer P) => any ? P : never;
```

### Mapped types with key remapping (TS 4.1+)
```ts
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type G = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }
```
Use `as never` to filter keys out.

### Template literal types
```ts
type Route = `/users/${string}` | `/posts/${number}`;
type ExtractParam<S> = S extends `${string}:${infer P}/${infer Rest}`
  ? P | ExtractParam<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P : never;
type P = ExtractParam<"/users/:id/posts/:postId">; // "id" | "postId"
```

### `satisfies` vs annotation vs `as const`
```ts
const colors = { red: "#f00", green: "#0f0" } satisfies Record<string, `#${string}`>;
// colors.red is "#f00" (narrow), and the object is checked against the constraint
```
- annotation (`: T`) -- widens the value to `T`.
- `satisfies T` -- checks against `T` without widening.
- `as const` -- recursively narrows to literal types and marks readonly.
Use `satisfies` when you want literal precision *and* a constraint check.

### Branded / nominal types
TypeScript is structural, so `type UserId = string` doesn't prevent passing a raw `string`. Add a phantom brand:
```ts
declare const brand: unique symbol;
type Brand<T, B> = T & { [brand]: B };
type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;
// function getUser(id: UserId) -- passing an OrderId is a compile error
```

### Variance and `in`/`out` (TS 4.7+)
You can explicitly annotate variance on generic type parameters: `interface Producer<out T>` (covariant), `Consumer<in T>` (contravariant). Useful for libraries; rarely needed in app code.

### Recursive types
JSON, trees, paths:
```ts
type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue };
type Paths<T> = T extends object
  ? { [K in keyof T & string]: K | `${K}.${Paths<T[K]>}` }[keyof T & string]
  : never;
```
TS limits recursion depth; deep recursion may need tail-call shapes.

### `keyof` + indexed access
```ts
type V = User["email"];       // string
type K = keyof User;          // "id" | "email" | ...
type Vals<T> = T[keyof T];    // union of value types
```

## Common pitfalls

- **`any` short-circuits everything**: `any extends T` is both true and false. Use `unknown` for "I don't know" and narrow it.
- **Distribution surprises**: `type NoNever<T> = T extends never ? never : T` distributes; `never` distributes to nothing, so `NoNever<never>` is `never`. Wrap in `[T] extends [never]` when checking exactly `never`.
- **`Record<string, X>` accepts everything**: index signatures hide missing keys. For exhaustive maps, use `Record<Union, X>` with a literal union.
- **`as` lies**: `value as T` is an assertion, not a check. Use a type guard (`function isT(v): v is T`) or [[zod-validation]] for runtime validation.
- **`Function` and `object` are too broad**: prefer `(...a: A) => R` and `Record<string, unknown>` (or specific shapes).
- **Over-recursive types cause "Type instantiation is excessively deep"**: simplify or split. There's no `@ts-extend-the-limit`.
- **`enum` quirks**: numeric enums are bidirectional and not tree-shakable. Prefer `const` objects + `as const` + `typeof obj[keyof typeof obj]`, or string literal unions.
- **`{}` means "any non-nullish"**, not "empty object". Use `Record<string, never>` for "truly empty".

## Reference

- Handbook: https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
- Utility types: https://www.typescriptlang.org/docs/handbook/utility-types.html
- type-challenges: https://github.com/type-challenges/type-challenges
- Related: [[zod-validation]] (runtime validation paired with `z.infer`), [[react-hook-form]] (generic inference over form schemas)
