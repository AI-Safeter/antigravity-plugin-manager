---
name: i18next-internationalization
description: 'i18next for application internationalization. Use this skill when adding or refactoring translations in JavaScript/TypeScript apps, organizing namespaces, writing plural and ICU rules, wiring react-i18next hooks, configuring language detection, or lazy-loading translation bundles. Triggers: i18next, react-i18next, i18n, l10n, translation, locale, plural rule, ICU MessageFormat, useTranslation, Trans component.'
---

# i18next Internationalization

i18next is the de facto translation framework for JavaScript. It handles key lookup, interpolation, pluralization, namespacing, language detection, and lazy loading of resource bundles across browser, Node, React Native, Next.js, and others. The pieces below get you from "hard-coded English strings" to "production multi-locale" without drowning in JSON.

## Use this skill when
- Introducing i18n to a JS/TS app for the first time and choosing keys/namespaces
- Picking between built-in plural rules and ICU MessageFormat
- Wiring `useTranslation`, `Trans`, and `Suspense` in React
- Lazy-loading namespaces and locales via `i18next-http-backend`
- Auto-detecting the user's language (cookie, querystring, browser, header)
- Migrating from string concatenation or `formatjs` to i18next

## Do not use this skill when
- The app has only one locale and no plans to add another
- You need rich CMS-driven translator workflows -- consider Phrase, Lokalise, Crowdin (they integrate on top of i18next)
- The app is server-only and you already use `Intl.MessageFormat` directly

## Core concepts
i18next loads `resources` -- a tree of `{ language: { namespace: { key: "string" } } }`. `t("ns:key", values)` resolves the key for the current `language`, falling back to `fallbackLng`. Plurals are selected by CLDR plural categories (`zero`, `one`, `two`, `few`, `many`, `other`). Interpolation replaces `{{name}}` with values; ICU MessageFormat (via `i18next-icu`) adds richer plural/select/number/date formatting.

## Quick start
```ts
// i18n.ts
import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

await i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "ko", "ja", "de"],
    ns: ["common", "checkout"],
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React already escapes
    backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
    detection: { order: ["querystring", "cookie", "navigator"], caches: ["cookie"] },
  });
```

```tsx
// component.tsx
import { useTranslation, Trans } from "react-i18next";

export function Cart({ count, user }: { count: number; user: string }) {
  const { t } = useTranslation("checkout");
  return (
    <>
      <h1>{t("title", { name: user })}</h1>
      <p>{t("itemCount", { count })}</p>
      <Trans i18nKey="terms">
        Read our <a href="/terms">terms</a> before continuing.
      </Trans>
    </>
  );
}
```

```json
// public/locales/en/checkout.json
{
  "title": "Welcome, {{name}}",
  "itemCount_one": "{{count}} item in cart",
  "itemCount_other": "{{count}} items in cart",
  "terms": "Read our <1>terms</1> before continuing."
}
```

## Key patterns

### Namespaces
- Split translations by feature/page: `common`, `auth`, `checkout`, `dashboard`. Smaller bundles, fewer merge conflicts.
- Set `defaultNS` so unprefixed keys don't need `t("common:save")` everywhere.
- Load only what a route needs: `useTranslation(["checkout", "common"])`.

### Plural rules (built-in)
- Use the suffix form: `key_one`, `key_other`, plus `_zero`, `_two`, `_few`, `_many` for languages that need them.
- Pass `{ count: n }` -- i18next picks the category via CLDR for the active language.
- Arabic has six forms; Korean and Japanese have one (just `_other`). Don't hardcode English's 2-form assumption.

### ICU MessageFormat (via i18next-icu)
- Install `i18next-icu` for advanced formatting in one string:
```
"{count, plural, =0 {No items} one {# item} other {# items}} for {gender, select, male {him} female {her} other {them}}"
```
- Prefer ICU when keys would otherwise multiply (gendered, nested plurals, currency/date formatting inline).
- Single source of truth per locale; translator tools (Phrase, Crowdin) understand ICU natively.

### Interpolation and formatting
- `t("greeting", { name: "Sam" })` substitutes `{{name}}`.
- Format values: `t("price", { val: 1999, formatParams: { val: { currency: "USD", style: "currency" } } })` uses `Intl.NumberFormat`.
- Disable HTML escaping in React (`escapeValue: false`) -- React handles XSS; do not disable in vanilla JS.

### `Trans` component for inline JSX
- Use when a translation contains markup like links or `<strong>`.
- Children are matched by index: `<Trans i18nKey="terms">Read our <a href="/terms">terms</a></Trans>` -- the JSON value uses `<1>terms</1>` for the `a` tag (index 1; text is index 0).
- Pass `components={{ 1: <a href="/terms" /> }}` if you want to define replacements explicitly.

### Lazy loading
- `i18next-http-backend` fetches `{{lng}}/{{ns}}.json` on demand.
- Combine with React `Suspense` (`react-i18next`'s `useTranslation` supports it) so first paint waits for the namespace.
- For SSR/Next.js use `next-i18next` or `react-i18next` with server-side preload to avoid hydration flicker.

### Language detection
- `i18next-browser-languagedetector` checks (in order): `?lng=` query, cookie, localStorage, `navigator.language`, HTML `lang` attribute.
- Cache the detected language in a cookie so SSR and CSR agree.
- Always set `supportedLngs` so a `pt-BR` browser doesn't get a missing-locale 404; i18next will fall back to `pt` then `fallbackLng`.

### Typed translations
- With TypeScript: declare a module augmentation:
```ts
import "i18next";
import en from "../public/locales/en/common.json";
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: { common: typeof en; checkout: typeof checkoutEn };
  }
}
```
- `t("save")` now autocompletes and type-errors on typos.

## Common pitfalls
- Forgetting `count` for plurals: `t("itemCount")` without `{ count }` resolves the `_other` form or the base key -- not what you want.
- Concatenating translated fragments: `t("part1") + " " + t("part2")` breaks word order in many languages. Use one key with interpolation.
- Hardcoding plural assumptions: writing only `_one` and `_other` works for English but breaks Russian (`_few`, `_many`).
- HTML in keys without `Trans`: `t("html")` returning `<a>...</a>` is rendered as text by React. Use `Trans` or `dangerouslyHTML` carefully.
- Mixing namespaces without prefix: if `defaultNS` is `common` and you call `t("title")` from a `checkout` page, you get the wrong key. Use `t("checkout:title")` or pass `{ ns: "checkout" }`.
- SSR hydration mismatch: server detects `en`, client cookie says `ko`. Read the cookie on the server first and pass through.
- Loading all locales upfront: makes the bundle huge. Lazy-load with `backend` and split by namespace.

## Reference
- Official docs: https://www.i18next.com/
- react-i18next: https://react.i18next.com/
- CLDR plural rules: https://cldr.unicode.org/index/cldr-spec/plural-rules
- ICU MessageFormat: https://unicode-org.github.io/icu/userguide/format_parse/messages/
- Related: [[react-fullstack]], [[nextjs-fullstack]]
