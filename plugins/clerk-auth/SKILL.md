---
name: clerk-auth
description: Clerk authentication for Next.js, React, and Remix apps. Use this skill when integrating ClerkProvider, useUser, useAuth, signIn/signUp components, organizations and multi-tenant auth, JWT templates, webhooks for user sync, or protecting API routes with auth() and clerkMiddleware.
---

# Clerk Authentication

Clerk is a hosted auth provider that gives you pre-built UI (`<SignIn />`, `<UserButton />`), session management, MFA, and multi-tenant organizations out of the box. The Next.js SDK is the most polished -- `clerkMiddleware()` protects routes, `auth()` reads sessions on the server, and `useUser()` / `useAuth()` cover the client. You sync Clerk users to your own DB via webhooks.

## Use this skill when

- Adding auth to a Next.js App Router or Pages Router project
- Building B2B SaaS with organizations, roles, and invitations
- Needing prebuilt MFA, magic links, social logins (Google, GitHub, etc.)
- Issuing custom JWTs for third-party services (Supabase, Convex, Hasura)
- Syncing Clerk users to a Postgres `users` table via `user.created` webhooks
- Protecting Next.js API routes and Server Actions

## Do not use this skill when

- You need fully self-hosted, OSS auth (use Auth.js or Lucia)
- You only need a single shared password (overkill)
- Your compliance regime forbids third-party hosted auth

## Core concepts

A `User` belongs to zero or more `Organizations` with a `role` (`org:admin`, `org:member`, or custom). A `Session` is a signed JWT (short-lived, ~60s) used by the SDK to authenticate API calls. `auth()` returns `{ userId, sessionId, orgId, orgRole, has, getToken }` server-side. Webhooks (Svix) deliver `user.created`, `user.updated`, `organization.created`, etc., for syncing to your DB.

## Quick start

```bash
npm install @clerk/nextjs
```

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtected = createRouteMatcher(['/dashboard(.*)', '/api/protected(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js|jpg|png|svg|ico)).*)', '/(api|trpc)(.*)'],
};
```

```tsx
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html><body>{children}</body></html>
    </ClerkProvider>
  );
}
```

```tsx
// app/dashboard/page.tsx -- server component
import { auth, currentUser } from '@clerk/nextjs/server';

export default async function Page() {
  const { userId, orgId } = await auth();
  const user = await currentUser();
  return <div>Hi {user?.firstName} -- org {orgId}</div>;
}
```

## Key patterns

### Protecting routes
`clerkMiddleware` + `createRouteMatcher` for declarative protection. For finer control inside handlers: `const { userId } = await auth(); if (!userId) return new Response('Unauthorized', { status: 401 });`.

### Client hooks
`const { isSignedIn, user } = useUser();` and `const { getToken, signOut } = useAuth();`. Use `<SignedIn>` / `<SignedOut>` for conditional UI.

### Organizations / multi-tenant
Enable in Dashboard, then use `<OrganizationSwitcher />`, `useOrganization()`, and `auth().orgRole`. Server: `const { has } = await auth(); if (!has({ permission: 'org:billing:manage' })) return forbidden();`.

### JWT templates for third-party services
Create a JWT Template in the Dashboard (e.g., for Supabase). Client: `const token = await getToken({ template: 'supabase' });`. Pass to the downstream service which verifies with Clerk's JWKS.

### Webhooks to sync users
Set up an endpoint at `/api/webhooks/clerk`. Verify with Svix:
```typescript
import { Webhook } from 'svix';
const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
const evt = wh.verify(rawBody, headers) as WebhookEvent;
if (evt.type === 'user.created') await db.users.insert({ clerk_id: evt.data.id, email: evt.data.email_addresses[0].email_address });
```

### Server Actions / Route Handlers
`auth()` works inside Server Actions, Route Handlers, and middleware. It reads from cookies set by `clerkMiddleware`, so make sure middleware matches the route.

## Common pitfalls

- **Missing middleware matcher**: if `clerkMiddleware` doesn't run on a route, `auth()` returns `{ userId: null }` even for signed-in users. The default matcher excludes static assets -- make sure your route matches.
- **Calling `auth()` in a client component**: it's server-only. Use `useAuth()` / `useUser()` on the client.
- **Forgetting `await` on `auth()`**: in App Router (Next 15+), `auth()` is async. Old `const { userId } = auth()` synchronous form is deprecated.
- **Sending the Clerk JWT to your own API and trusting `sub` blindly**: verify it with `@clerk/backend`'s `verifyToken` or use `auth()` which already does.
- **Webhook signature not verified**: anyone can POST fake `user.created` events. Always verify with `svix` + `CLERK_WEBHOOK_SECRET`.
- **Hardcoded org role strings**: use `auth().has({ role: 'org:admin' })` or `has({ permission: '...' })` rather than string comparison; permissions are more granular and stable.

## Security considerations

- **API keys**: `CLERK_SECRET_KEY` (sk_test_/sk_live_) is server-only. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_test_/pk_live_) is safe in the browser.
- **Webhook secret**: `CLERK_WEBHOOK_SECRET` must be stored in env vars, verified with Svix on every webhook POST.
- **JWT verification**: when passing Clerk tokens to other backends, verify them with Clerk's JWKS endpoint or `@clerk/backend`. Never trust `sub` without signature check.
- **Session token leakage**: don't log `getToken()` output. Treat it like a bearer token.
- **Production vs dev instances**: Clerk dev instances allow `*.clerk.accounts.dev`. Live instances require a verified domain -- set DNS records before deploy.
- **PII**: user emails and metadata are stored at Clerk. Review their DPA for compliance fit.

## Reference

- Official docs: https://clerk.com/docs
- Next.js quickstart: https://clerk.com/docs/quickstarts/nextjs
- `auth()` / `clerkMiddleware`: https://clerk.com/docs/references/nextjs/auth
- Webhooks: https://clerk.com/docs/integrations/webhooks/overview
- Related: [[nextauth-authjs]], [[stripe-payments]]
