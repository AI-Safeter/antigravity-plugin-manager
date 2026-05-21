---
name: nextauth-authjs
description: Auth.js (formerly NextAuth.js) v5 for Next.js authentication. Use this skill when configuring providers (OAuth, credentials, email), callbacks (jwt, session, signIn), session strategies (JWT vs database), Edge-compatible middleware, or migrating from NextAuth v4 to Auth.js v5.
---

# Auth.js (NextAuth) v5

Auth.js v5 (the renamed NextAuth.js) is the de-facto OSS auth library for Next.js. It supports 80+ OAuth providers, credentials, magic links, and a JWT-or-database session model. v5 is a significant rewrite: configuration moved to a top-level `auth.ts`, `auth()` replaces `getServerSession`, and middleware is Edge-compatible. Self-hosted, no vendor lock-in.

## Use this skill when

- Adding auth to a Next.js App Router app without a hosted provider
- Wiring Google/GitHub/Discord/etc. OAuth in minutes
- Using credentials provider with your own user DB
- Choosing between JWT and database sessions
- Customizing the JWT payload, session shape, or sign-in logic via callbacks
- Migrating from NextAuth v4 (Pages Router) to Auth.js v5 (App Router)

## Do not use this skill when

- You want a hosted UI and org management (use Clerk or WorkOS)
- You're not on Next.js (Auth.js has framework adapters for SvelteKit/Express, but Clerk/Lucia may fit better)
- You need passkeys with first-class UI today (basic WebAuthn support exists but is less polished than Clerk's)

## Core concepts

A `Provider` defines a sign-in method (OAuth, Credentials, Email). A `Session` is either a JWT stored in an HTTP-only cookie (`strategy: 'jwt'`) or a row in your DB referenced by an opaque session cookie (`strategy: 'database'`). `Callbacks` (`jwt`, `session`, `signIn`, `redirect`) let you mutate tokens, decide who can sign in, and shape what the client sees. `Adapter` connects database sessions to Prisma/Drizzle/Postgres/etc.

## Quick start

```bash
npm install next-auth@beta
# generate a secret
npx auth secret  # writes AUTH_SECRET to .env.local
```

```typescript
// auth.ts (project root)
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({ clientId: process.env.AUTH_GITHUB_ID!, clientSecret: process.env.AUTH_GITHUB_SECRET! }),
    Google,
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      (session.user as any).role = token.role;
      return session;
    },
  },
});
```

```typescript
// app/api/auth/[...nextauth]/route.ts
export { GET, POST } from '@/auth';

// middleware.ts
export { auth as middleware } from '@/auth';
```

```tsx
// app/page.tsx
import { auth, signIn, signOut } from '@/auth';

export default async function Home() {
  const session = await auth();
  return session
    ? <form action={async () => { 'use server'; await signOut(); }}><button>Sign out</button></form>
    : <form action={async () => { 'use server'; await signIn('github'); }}><button>Sign in with GitHub</button></form>;
}
```

## Key patterns

### JWT vs database sessions
- **JWT** (default): stateless, fast, no DB lookup per request. Logout requires waiting for token expiry unless you maintain a revocation list.
- **Database**: requires an adapter (Prisma, Drizzle, etc.). Sessions are revocable instantly. Use for high-security or session-list features.

### Credentials provider
For username/password against your own DB:
```typescript
import Credentials from 'next-auth/providers/credentials';
Credentials({
  credentials: { email: {}, password: {} },
  async authorize(creds) {
    const user = await db.user.findUnique({ where: { email: creds.email as string } });
    if (!user || !(await bcrypt.compare(creds.password as string, user.hash))) return null;
    return { id: user.id, email: user.email, role: user.role };
  },
});
```
Note: credentials provider requires `strategy: 'jwt'`.

### Callbacks
- `signIn({ user, account })`: return `false` to block, or a URL string to redirect.
- `jwt({ token, user, trigger })`: runs on sign-in and on every session check; mutate token here to add custom claims.
- `session({ session, token })`: shape what the client sees in `useSession()`.

### Protecting routes
Middleware: re-export `auth as middleware`. Inside Server Components / Server Actions: `const session = await auth(); if (!session) redirect('/login');`. Inside Route Handlers: same `auth()` API.

### Adapters (database sessions)
```typescript
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
export const { auth } = NextAuth({ adapter: PrismaAdapter(prisma), session: { strategy: 'database' }, providers: [...] });
```

### Edge runtime caveats
`middleware.ts` runs on Edge. Adapters that use Node-only DB drivers (e.g., `pg`) break here. Split config: a slim Edge-safe `auth.config.ts` for middleware, full `auth.ts` for Node routes. Auth.js docs call this "split config".

## Common pitfalls

- **`AUTH_SECRET` missing in production**: tokens fail to sign and every request returns null sessions silently. Always set in env, generate with `openssl rand -base64 32`.
- **OAuth callback URL mismatch**: must be `https://yourdomain.com/api/auth/callback/github` (etc). Update both Auth.js config and the OAuth app settings.
- **Using Credentials with database sessions**: not supported. Credentials forces JWT strategy.
- **Mutating `session.user.id` without updating the type**: extend types in a `next-auth.d.ts` declaration file.
- **`useSession()` in App Router server components**: it's client-only. Use `await auth()` server-side.
- **Edge middleware loading Node modules**: keep middleware imports thin or use the split-config pattern.
- **NextAuth v4 patterns in v5**: `getServerSession` is gone, `[...nextauth].ts` Pages Router style still works but App Router is recommended. Check migration guide.

## Security considerations

- **AUTH_SECRET**: 32+ random bytes, never commit, rotate annually. Used to sign JWTs and encrypt cookies.
- **OAuth client secrets**: `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_SECRET`, etc. -- env vars only, never in client bundles.
- **Cookie flags**: Auth.js sets `httpOnly`, `secure` (in production), and `sameSite: 'lax'` by default. Don't override unless you understand CSRF implications.
- **CSRF**: Auth.js has built-in CSRF tokens for credential sign-in. Don't disable.
- **Password hashing in Credentials provider**: use `bcrypt`, `argon2`, or `scrypt`. Never store plaintext or MD5/SHA-1.
- **Trust host**: in production behind a proxy, set `AUTH_TRUST_HOST=true` or configure `trustHost` explicitly. Without it, the callback URL detection can be hijacked.
- **JWT contents are not encrypted by default in v4** (they were JWE). v5 uses encrypted JWE tokens by default, but don't put PII in the token regardless.

## Reference

- Official docs: https://authjs.dev
- Migration v4 to v5: https://authjs.dev/getting-started/migrating-to-v5
- Providers: https://authjs.dev/getting-started/authentication/oauth
- Adapters: https://authjs.dev/getting-started/database
- Related: [[clerk-auth]], [[stripe-payments]]
