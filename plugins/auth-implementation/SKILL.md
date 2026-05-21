---
name: auth-implementation
description: Authentication implementation covering sessions vs tokens, secure cookies, CSRF defenses, password hashing with Argon2id/bcrypt, MFA TOTP, email verification, magic links, and account recovery. Use when building login, signup, password reset, MFA, or session management, or when reviewing an auth surface for common attack vectors.
---

# Auth Implementation

Concrete guidance for the auth surface of an application: how to store passwords, how to set cookies that survive modern browser defaults, how to defend against CSRF and credential stuffing, and how to design recovery flows that don't become the attack itself.

## Use this skill when

- Implementing login, signup, logout, or session management
- Choosing between session cookies and bearer tokens for your transport
- Adding MFA (TOTP, WebAuthn) to an existing auth system
- Designing email verification, magic-link, or password-reset flows
- Reviewing an existing auth implementation for vulnerabilities
- Hardening against credential stuffing, session fixation, or account takeover

## Do not use this skill when

- You need OAuth2 / OIDC integration specifics (see jwt-oauth2-flows)
- The question is about authorization models (RBAC/ABAC/policy engines)
- You're picking an enterprise SSO/SAML provider

## Core concepts

- **Authentication vs authorization**: AuthN proves who; AuthZ decides what they can do. Separate the two in code; never let a route handler check both with ad-hoc conditionals.
- **Session vs token**: A session is server-side state referenced by an opaque ID stored in a cookie. A token (typically JWT) is self-contained and verified cryptographically. Sessions are easier to revoke; tokens scale across services without a shared session store.
- **First-party vs third-party context**: Browsers increasingly treat third-party cookies as hostile. If your auth backend lives on a different eTLD+1 from your frontend, expect SameSite and partitioning headaches. Use a subdomain of the same site when possible.
- **Threat model**: the common attacks worth designing against are credential stuffing, phishing, XSS-driven token theft, CSRF, session fixation, password reset poisoning, enumeration of valid accounts, and replay of expired flow links.
- **Defense in depth**: rate limiting, MFA, anomaly detection, and short session lifetimes each reduce the blast radius when one layer fails.

## Quick start

A minimal session login endpoint (Node/Express-style pseudocode):

```ts
app.post('/login', rateLimit({ max: 10, window: '1m' }), async (req, res) => {
 const { email, password } = req.body;
 const user = await db.users.findByEmail(email);
 // Constant-time path: always run the verifier even if user is missing.
 const ok = await argon2.verify(user?.password_hash ?? DUMMY_HASH, password);
 if (!user || !ok) return res.status(401).json({ error: 'invalid credentials' });

 if (user.mfa_enabled) {
 const challenge = await createMfaChallenge(user.id);
 return res.json({ mfa_required: true, challenge_id: challenge.id });
 }

 await rotateSession(req, res, user.id); // create new session id, set cookie
});
```

Cookie attributes that should be defaults for any auth cookie:

```
Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400
```

## Key patterns

### Password hashing

- **Argon2id** is the current best choice. Tune memory (>= 64 MiB), iterations (>= 3), and parallelism (1-4) to take 100-500 ms on your hardware.
- **bcrypt** is acceptable; use cost 12+ and remember bcrypt silently truncates inputs at 72 bytes (pre-hash with SHA-256 or HMAC if you allow long passwords).
- **scrypt** is fine; PBKDF2 only when compliance forces it.
- Never roll your own. Never use MD5, SHA-1, SHA-256, or any unsalted hash for passwords. Re-hash on login if the stored parameters are weaker than your current target (rehash transparently after successful verification).
- Run the verifier even when the user does not exist, against a dummy hash, to avoid user-enumeration timing oracles.

### Session cookies

- `HttpOnly` blocks `document.cookie` access - defeats XSS exfiltration.
- `Secure` requires HTTPS - never ship without it outside localhost.
- `SameSite=Lax` is the modern default. Use `Strict` for sensitive admin sessions if you can tolerate the UX. `None` requires `Secure` and is for third-party contexts only.
- `__Host-` prefix (e.g., `__Host-sid`) requires `Secure`, `Path=/`, and no `Domain` attribute - a free integrity boost.
- Rotate the session ID on login and on privilege change. Never accept an attacker-supplied session ID (session fixation).
- Server-side store with absolute expiry (e.g., 12 hours) and idle expiry (e.g., 1 hour). On logout, delete the server-side record, not just the cookie.

### CSRF protection

- For cookie-authenticated, state-changing requests, you need CSRF defense even with SameSite=Lax (top-level GET-then-POST forms can still slip through in some configurations).
- **Double-submit token**: server sets a random token in a non-HttpOnly cookie and the SPA echoes it in a custom header (`X-CSRF-Token`). Server checks they match.
- **Synchronizer token**: server stores a per-session token and requires it in form submissions. Stronger than double-submit but requires server state.
- **Origin / Referer check**: cheap belt-and-suspenders; verify `Origin` matches your domain on state-changing requests.
- Pure bearer-token APIs (Authorization header) are not vulnerable to CSRF in the classic sense - browsers don't auto-attach Authorization headers.

### MFA (TOTP and WebAuthn)

- **TOTP** (RFC 6238): 30-second time step, 6 digits, SHA-1 is still the interoperable default with authenticator apps. Allow +-1 step for clock skew. Store the shared secret encrypted at rest. Generate 8-10 single-use recovery codes (hashed like passwords) at enrollment.
- Verify TOTP codes server-side; rate-limit attempts; lock after a small number of failures within a window.
- **WebAuthn / passkeys** are stronger than TOTP - phishing-resistant, no shared secret. Offer it as an option and prefer it for new enrollments. Store the credential ID and public key per user, support multiple devices.
- Always allow more than one MFA factor per account so a lost phone is not a lost account.

### Email verification

- On signup, set `email_verified = false` and require a click-through link before granting full access (or before allowing sensitive actions).
- Link contains an opaque, single-use token (random 32 bytes, base64url) stored hashed server-side with a short TTL (24-48 h).
- After verification, invalidate the token and mark verified atomically.
- Do not reveal whether an email is registered during signup - use the same response and send "you may already have an account" via email instead.

### Magic links

- Same primitives as email verification: random opaque token, hashed server-side, single-use, short TTL (5-15 min).
- Tie the token to the requesting IP or user agent only if your UX tolerates broken cross-device flows; many users open links on a different device.
- Rate-limit issuance per email and per IP.
- After consumption, create a session and rotate the token.

### Account recovery

- Recovery is the weakest link in most systems. Treat it as a parallel auth path with full MFA, not a bypass.
- Password reset: same opaque-token-by-email pattern, single-use, short TTL. On successful reset, invalidate all existing sessions and refresh tokens.
- Never email a password back. Never use security questions as a primary factor.
- For high-value accounts, require a delay (e.g., 24 h) and notify the user via every channel during the wait.

### Defending against credential stuffing

- Rate-limit login attempts per IP, per account, and globally. Add exponential backoff and CAPTCHA on suspicious patterns.
- Check submitted passwords against the Pwned Passwords k-anonymity API at signup and at password change.
- Require MFA on all accounts where possible; require it on admin accounts always.
- Alert users on logins from new devices or geographies.

## Common pitfalls

- Storing JWTs or session IDs in `localStorage` "for SPA convenience." Any XSS = full account takeover. HttpOnly cookies are the default.
- Forgetting to rotate the session ID on login. An attacker who set a session cookie via a fixation attack now owns the post-login session.
- Returning different responses for "user not found" vs "wrong password" - enables enumeration. Same response, same timing.
- Using bcrypt without realizing 72-byte truncation; very long passwords or unicode-heavy inputs silently get truncated.
- Implementing CSRF protection but exempting "convenience" endpoints. The one unprotected state-changing endpoint is the one that gets hit.
- Issuing password-reset tokens with weak randomness (`Math.random`, sequential IDs). Use `crypto.randomBytes(32)` or equivalent.
- Treating MFA as one-and-done; not allowing the user to enroll multiple factors or recover from a lost device, leading to mass account lockouts.
- Logging request bodies that include passwords or tokens. Redact at the framework or logger layer.

## Reference

- OWASP Authentication Cheat Sheet: cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet
- OWASP Password Storage Cheat Sheet (Argon2id parameter guidance)
- NIST SP 800-63B Digital Identity Guidelines
- Pwned Passwords API: haveibeenpwned.com/API/v3#PwnedPasswords
- WebAuthn Guide: webauthn.guide
