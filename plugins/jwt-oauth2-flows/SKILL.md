---
name: jwt-oauth2-flows
description: JWT structure, signing algorithms, and OAuth2/OIDC flows including authorization code with PKCE, client credentials, and refresh tokens. Use when integrating an OAuth2 provider, validating tokens on a server, choosing HS256 vs RS256, debugging redirect URIs, or distinguishing ID tokens from access tokens.
---

# JWT and OAuth2 Flows

JWT is a token format; OAuth2 is a delegation framework; OIDC is an identity layer on top of OAuth2. They are often confused. This skill covers the structural details and the flows you actually use in production, with emphasis on the validation steps and pitfalls that cause real breaches.

## Use this skill when

- Integrating an OAuth2 / OIDC provider (Auth0, Okta, Cognito, Keycloak, Google, GitHub)
- Validating an incoming JWT on a backend
- Choosing between HS256, RS256, and EdDSA
- Implementing the authorization code flow with PKCE in an SPA or mobile app
- Implementing the client credentials flow for service-to-service auth
- Designing refresh-token rotation and revocation
- Debugging "invalid audience" / "invalid issuer" / clock-skew errors

## Do not use this skill when

- You only need session-cookie authentication for a server-rendered app (see auth-implementation)
- The question is about SAML or other non-OAuth2 federation
- You're picking a password hashing algorithm

## Core concepts

- **JWT structure**: `header.payload.signature`, each base64url-encoded. Header declares `alg` and `kid`. Payload is JSON claims. Signature covers `header.payload` using `alg`.
- **JWS vs JWE**: JWT signed (JWS) is the common case - readable, not encrypted, integrity-protected. JWT encrypted (JWE) is rare; use it only for tokens that must be opaque to clients.
- **Standard claims**: `iss` (issuer), `sub` (subject), `aud` (audience), `exp` (expiry, seconds since epoch), `nbf` (not-before), `iat` (issued-at), `jti` (token id). Validate all of them.
- **Symmetric vs asymmetric**: HS256 uses a shared secret - only suitable when issuer and verifier are the same party (same backend signs and verifies). RS256 / ES256 / EdDSA use a private key to sign and a public key (published via JWKS) to verify - required for federated scenarios where verifiers don't share secrets.
- **OAuth2 roles**: resource owner (the user), client (the app), authorization server (issues tokens), resource server (accepts tokens). OIDC adds an ID token that asserts who the user is.
- **Access token vs ID token**: Access tokens are for calling APIs (resource servers). ID tokens are for the client to learn about the user. Never send an ID token to an API.

## Quick start

Validate an RS256 JWT in Node with `jose`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://example.auth0.com/.well-known/jwks.json'));

const { payload } = await jwtVerify(token, JWKS, {
 issuer: 'https://example.auth0.com/',
 audience: 'https://api.example.com',
 algorithms: ['RS256'],
 clockTolerance: '5s',
});
// payload.sub, payload.scope, etc.
```

PKCE pair in a browser SPA:

```ts
const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
// store verifier in sessionStorage; send challenge in the /authorize redirect
```

## Key patterns

### Authorization Code + PKCE (SPAs, mobile, CLI)

The modern default for any public client.

1. Client generates a random `code_verifier` and a `code_challenge = SHA256(verifier)` (base64url).
2. Browser redirects to `/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state` (CSRF), `code_challenge`, `code_challenge_method=S256`. Add `nonce` for OIDC.
3. User authenticates; provider redirects back with `?code=...&state=...`.
4. Client verifies `state`, then POSTs to `/token` with `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`.
5. Provider returns `access_token`, optionally `refresh_token`, and (for OIDC) `id_token`.

Implicit flow is deprecated. Do not use it.

### Client Credentials (service-to-service)

```
POST /oauth/token
grant_type=client_credentials&client_id=...&client_secret=...&audience=https://api.example.com&scope=read:things
```

Backend gets an access token bound to the client itself (no user). Cache the token until shortly before `exp`; rotate the client secret periodically.

### Refresh tokens

- Long-lived; treat them like passwords. Store server-side or in HttpOnly cookies - never `localStorage`.
- Use **refresh token rotation**: each refresh response returns a new refresh token and invalidates the old one. If the old token is presented again, treat it as theft and revoke the entire family.
- Set `offline_access` scope (OIDC) when you need a refresh token.

### Token validation checklist (always, in this order)

1. Parse header and check `alg` is in your allowlist. Reject `none`. Reject HS256 if you expect RS256 (the classic confused-deputy bug).
2. Resolve verification key by `kid` from the issuer's JWKS, cached with a sensible TTL.
3. Verify signature.
4. Check `iss` equals your expected issuer string exactly.
5. Check `aud` includes the API identifier. Reject if missing.
6. Check `exp` is in the future and `nbf`/`iat` are sane, with a small clock tolerance (30-60s max).
7. Optionally check `azp` (authorized party) when multiple clients share an issuer.
8. Check scopes / permissions for the requested action.

### HS256 vs RS256 vs EdDSA

- **HS256**: HMAC-SHA256 with a shared secret. Fast, simple, but anyone who can verify can also forge tokens. Only for first-party where the same service issues and validates.
- **RS256**: RSA-2048 signature. Public key published via JWKS. The default for federated identity providers.
- **ES256**: ECDSA over P-256. Smaller signatures, faster than RSA. Increasingly the default for new deployments.
- **EdDSA (Ed25519)**: smallest and fastest. Supported by newer libraries; check your provider.
- Never accept multiple algorithm families in the same verifier. Always pin `algorithms: [...]` to a specific set.

### Discovery and JWKS

OIDC providers publish `/.well-known/openid-configuration` with the issuer, `jwks_uri`, `authorization_endpoint`, `token_endpoint`, and supported algorithms. Use a library that fetches and caches JWKS keyed by `kid`. Re-fetch on cache miss (rotation), not per request.

### OIDC vs OAuth2

- OAuth2 alone gives you authorization (access tokens for APIs). It says nothing about who the user is.
- OIDC adds: an `id_token` JWT containing user claims, a standardized `userinfo` endpoint, the `openid` scope, and the `nonce` parameter to bind the ID token to a specific authorization request.
- If you find yourself parsing an access token to learn the user's email, you are doing it wrong. Use the ID token or call `userinfo`.

## Common pitfalls

- **Storing tokens in `localStorage`**: any XSS exfiltrates them. Use HttpOnly + Secure + SameSite cookies for browser clients; if you must use JS-accessible storage, accept that XSS = full token theft and harden accordingly.
- **Not validating `aud` and `iss`**: a token issued for service A is happily accepted by service B. This is exploited regularly.
- **Trusting the `alg` header**: an attacker sends `alg: none` or downgrades RS256 to HS256 using the public key as the HMAC secret. Always pin algorithms server-side.
- **No clock tolerance**: tokens fail validation across machines with drifting clocks. 30-60 seconds of tolerance is standard; more than that is a smell.
- **Long-lived access tokens**: 15-60 minutes is normal. If you need longer sessions, use a refresh token with rotation, not a multi-day access token.
- **Skipping `state` and `nonce`**: `state` defends the redirect against CSRF; `nonce` binds the ID token to the request. Both are required for browser flows.
- **Reusing PKCE verifiers**: generate a fresh verifier per authorization request. Never persist or reuse.
- **Confusing ID tokens and access tokens**: do not send ID tokens to APIs; do not parse access tokens on the client (they may be opaque).
- **Embedding sensitive PII in JWT claims**: tokens are not encrypted by default. Anyone with the token can read them.

## Reference

- RFC 6749 (OAuth 2.0), RFC 7636 (PKCE), RFC 9700 (OAuth 2.0 Security Best Current Practice)
- RFC 7519 (JWT), RFC 7515 (JWS), RFC 7517 (JWK), RFC 8725 (JWT BCP)
- OpenID Connect Core 1.0: openid.net/specs/openid-connect-core-1_0.html
- jose (Node/Deno/browser): github.com/panva/jose
- jwt.io debugger (for local inspection only, never paste production tokens)
