---
name: resend-email
description: Resend transactional email API with the Node.js SDK and React Email templates. Use this skill when sending transactional emails, building React Email templates, managing audiences and broadcasts, setting up sending domains with DKIM/SPF, or handling delivery webhooks.
---

# Resend Email

Resend is a transactional email API designed for developers, with a clean SDK, first-class React Email template support, and straightforward domain authentication. The DX is the main draw: send an email is one `resend.emails.send({...})` call, and templates are JSX components rendered to HTML at send time. Use it for password resets, receipts, magic links, and lightweight marketing broadcasts.

## Use this skill when

- Sending transactional emails (welcome, password reset, receipts, magic links)
- Building React Email templates with `@react-email/components`
- Setting up a sending domain with DKIM/SPF/DMARC
- Managing audiences and broadcasts (newsletters)
- Handling delivery webhooks (`email.delivered`, `email.bounced`, `email.complained`)
- Replacing SendGrid/Postmark/Mailgun for a modern DX

## Do not use this skill when

- You need a full marketing automation suite (use Customer.io, Braze)
- You need SMS or push notifications (Twilio, Postmark, OneSignal)
- You require self-hosted email (run Postal or Postfix)

## Core concepts

The unit of work is an `Email` -- `from`, `to`, `subject`, and either `html`, `text`, or a React component via `react`. Sending happens through a verified `Domain`. `Audiences` are lists of `Contacts`; `Broadcasts` are one-to-many sends to an audience. Webhooks deliver lifecycle events: `email.sent`, `email.delivered`, `email.bounced`, `email.opened`, `email.clicked`, `email.complained`.

## Quick start

```bash
npm install resend
# Optional: React Email templates
npm install @react-email/components react react-dom
```

```typescript
// send.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@updates.acme.com>',
  to: ['user@example.com'],
  subject: 'Welcome to Acme',
  html: '<p>Thanks for signing up.</p>',
  // or: react: <WelcomeEmail name="Sam" />,
  // or: text: 'Thanks for signing up.',
  headers: { 'X-Entity-Ref-ID': 'user_123' },
  tags: [{ name: 'category', value: 'welcome' }],
});

if (error) throw error;
console.log('sent:', data?.id);
```

## Key patterns

### React Email templates
```tsx
// emails/welcome.tsx
import { Html, Button, Heading, Text } from '@react-email/components';
export default function WelcomeEmail({ name }: { name: string }) {
  return (
    <Html>
      <Heading>Welcome, {name}</Heading>
      <Text>Click below to verify your email.</Text>
      <Button href="https://acme.com/verify">Verify</Button>
    </Html>
  );
}
```
Pass `react: <WelcomeEmail name={user.name} />` to `resend.emails.send`. Resend renders to HTML server-side.

### Domain setup
Add a sending domain in the Resend dashboard. Add the DKIM (CNAME), SPF (TXT), and DMARC (TXT) records to DNS. Wait for verification. Send `from: 'name@your-verified-domain.com'`. Subdomain like `updates.acme.com` is recommended to isolate sending reputation.

### Batch sending
`resend.batch.send([{...}, {...}])` -- up to 100 emails per call. More efficient than looping `emails.send`.

### Idempotency
Pass `{ idempotencyKey: 'order_123:receipt' }` in the second arg to `send` (SDK v4+). Resend dedupes retries for 24 hours, preventing double sends on network retries.

### Webhooks
Create a webhook endpoint in the dashboard. Verify the signature with `Svix`:
```typescript
import { Webhook } from 'svix';
const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);
const evt = wh.verify(rawBody, headers);
// evt.type: 'email.delivered' | 'email.bounced' | ...
```

### Audiences and broadcasts
```typescript
await resend.contacts.create({ email: 'a@b.com', audienceId: 'aud_xxx' });
await resend.broadcasts.create({ audienceId: 'aud_xxx', from: '...', subject: '...', html: '...' });
await resend.broadcasts.send('broadcast_xxx');
```

## Common pitfalls

- **Sending from an unverified domain**: emails go to spam or are rejected. Verify DNS first, wait 5-15 minutes for propagation.
- **Missing DMARC**: with no DMARC record, Gmail and Yahoo (post-2024) bulk-sender rules will throttle or reject. Add `_dmarc` TXT: `v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com`.
- **Reusing the main domain for transactional**: a hot subdomain (`mail.acme.com`) isolates reputation from your corporate `acme.com`.
- **Plain-text fallback missing**: provide `text` alongside `html` (or let React Email auto-generate) for better deliverability and accessibility.
- **No webhook signature verification**: anyone can POST fake bounce events. Always verify with Svix.
- **Hardcoded recipient in dev**: send to a test inbox like Mailtrap or Resend's test address `delivered@resend.dev` in dev environments.
- **Large attachments**: limit ~40MB. Use links to S3 for large files.

## Security considerations

- **API key**: `RESEND_API_KEY` (`re_...`) is server-only. Never ship in client bundles. Use restricted API keys (sending-only vs full-access) for least privilege.
- **Webhook signature**: verify `RESEND_WEBHOOK_SECRET` on every webhook POST using Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`).
- **SPF/DKIM/DMARC**: required for production. Without them, your mail will fail authentication checks and be flagged as spam.
- **Reply-To handling**: don't put user input directly in `replyTo` without validation -- header injection is possible.
- **PII in subject lines**: subjects are logged by mail providers and shown in notification UIs. Avoid putting sensitive tokens or PII there.
- **Rate limits**: free tier ~3,000/month, default 10 req/s. Implement client-side queueing and retry with backoff.
- **Test mode**: send to `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` to exercise webhook paths without real recipients.

## Reference

- Official docs: https://resend.com/docs
- React Email: https://react.email/docs
- Node SDK: https://resend.com/docs/send-with-nodejs
- Webhooks: https://resend.com/docs/dashboard/webhooks/introduction
- Related: [[clerk-auth]], [[nextauth-authjs]], [[stripe-payments]]
