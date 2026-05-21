---
name: react-hook-form
description: React Hook Form for performant, uncontrolled-by-default form handling in React. Use this skill when building forms with useForm, register, handleSubmit, Controller, useFieldArray, integrating schema validation via @hookform/resolvers (zod, yup, valibot), handling form state, errors, dirty/touched tracking, or optimizing re-renders on large forms. Triggers on useForm, register, Controller, formState, resolver, useFieldArray, or any React form work.
---

# React Hook Form

React Hook Form (RHF) is a small, performant form library for React that minimizes re-renders by keeping form state in refs and using uncontrolled inputs by default. It pairs naturally with schema validators (Zod, Yup, Valibot) via `@hookform/resolvers` and is the standard choice for non-trivial React forms.

## Use this skill when

- Building any React form beyond a one-field input
- Integrating Zod/Yup/Valibot schema validation with a React form
- Managing dynamic lists of fields (add/remove rows) via `useFieldArray`
- Wrapping controlled component libraries (MUI, Mantine, react-select) using `Controller`
- Reducing re-renders on large forms where Formik becomes sluggish
- Wiring server-side errors back into client-side form state

## Do not use this skill when

- The "form" is a single input with no validation (raw `useState` is simpler)
- You need a fully controlled, redux-style form state machine (consider TanStack Form or Formik)
- You're on a non-React framework (use VeeValidate for Vue, sveltekit-superforms for Svelte)

## Core concepts

`useForm()` returns an object with `register` (wires a native input by ref), `handleSubmit` (validates then calls your handler), `control` (passed to `Controller` for controlled components), `formState` (errors, isDirty, isSubmitting, touchedFields), and `watch`/`setValue`/`reset`/`getValues`. Uncontrolled inputs avoid re-rendering the whole form on every keystroke; that's where the performance comes from.

## Quick start

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type FormValues = z.infer<typeof Schema>;

export function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(Schema) });

  const onSubmit = async (data: FormValues) => { await api.login(data); };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}
      <input type="password" {...register("password")} />
      {errors.password && <p>{errors.password.message}</p>}
      <button disabled={isSubmitting}>Sign in</button>
    </form>
  );
}
```

## Key patterns

### Schema resolver
Install `@hookform/resolvers` and pass the matching resolver to `useForm`:
```ts
useForm({ resolver: zodResolver(Schema) });
```
Inferred types from the schema flow through `register`, `errors`, and the submit handler.

### Controller for non-native inputs
For component libraries that don't expose a `ref`/`onChange`/`value` triple cleanly:
```tsx
<Controller
  control={control}
  name="country"
  render={({ field, fieldState }) => (
    <Select {...field} options={countries} />
  )}
/>
```

### useFieldArray for dynamic lists
```tsx
const { fields, append, remove } = useFieldArray({ control, name: "items" });
fields.map((f, i) => <input key={f.id} {...register(`items.${i}.name`)} />);
```
The `f.id` (RHF-generated) is the correct React key -- not the index.

### Server-side errors
After a failed API call, push errors into form state:
```ts
setError("email", { type: "server", message: "Already taken" });
```

### Default values and reset
Provide `defaultValues` to `useForm` (synchronously) or call `reset(newValues)` once async data arrives. Avoid mixing both -- pick one strategy.

### Watching values
`watch("field")` re-renders the component on change. For deep subscriptions without parent re-renders, use `useWatch({ control, name })` in a child.

## Common pitfalls

- **Forgetting the spread**: `<input {...register("name")} />` -- without the spread, the field is not registered.
- **Index as key in field arrays**: use `field.id` from `useFieldArray`, never the array index, or animations and focus break on reorder.
- **`watch` everywhere**: `watch()` with no args subscribes to all fields and re-renders on every keystroke. Scope it: `watch("specificField")` or use `useWatch` in a child.
- **Async defaultValues**: passing `defaultValues` that change after mount does nothing. Either await the data before mounting the form or call `reset(data)` in a `useEffect`.
- **Number inputs come back as strings**: `<input type="number" {...register("age")} />` yields a string. Use `register("age", { valueAsNumber: true })` or let your Zod schema coerce.
- **Validation mode**: default is `onSubmit`. For live validation use `mode: "onChange"` or `"onBlur"` -- but expect more renders.
- **Controlled inputs without Controller**: passing `value` and `onChange` manually defeats RHF. Use `register` for native inputs or `Controller` for component libraries.

## Reference

- Official docs: https://react-hook-form.com
- Resolvers: https://github.com/react-hook-form/resolvers
- Related: [[zod-validation]] (via `zodResolver`), [[tanstack-query]] (for submitting forms with `useMutation`)
