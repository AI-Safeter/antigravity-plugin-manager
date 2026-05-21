---
name: stripe-payments
description: Stripe payments integration covering charges, customers, subscriptions, Checkout, webhooks, refunds, and PaymentIntents. Use this skill when accepting credit cards, building subscription billing, handling Stripe webhooks, implementing idempotent payment flows, or working with Stripe SDKs (stripe-node, stripe-python, stripe.js).
---

# Stripe Payments

Stripe is the dominant API for accepting online payments. Modern Stripe integrations are PaymentIntent-centric: the server creates a PaymentIntent, the client confirms it (often with Stripe Elements or Checkout), and webhooks deliver the authoritative state changes. Treat the webhook as the source of truth, not the client response.

## Use this skill when

- Adding card payments to a web or mobile app
- Building subscription billing (Stripe Billing, recurring invoices)
- Integrating Stripe Checkout, Payment Links, or Elements
- Handling webhooks for `payment_intent.succeeded`, `invoice.paid`, etc.
- Implementing refunds, disputes, or partial captures
- Adding Stripe Connect for marketplaces or platforms

## Do not use this skill when

- You need a different processor (PayPal, Adyen, Braintree)
- You only need a one-off "Buy Now" button with no backend (use a Payment Link)
- You are doing PCI-scope card-data handling without Elements or Checkout (do not)

## Core concepts

A `PaymentIntent` represents the lifecycle of collecting a payment from a single customer. A `SetupIntent` saves a payment method without charging. `Customer` objects persist across charges and store default payment methods. `Subscription` objects bind a Customer to recurring `Price` objects. Webhooks deliver the canonical post-3DS, post-auth state.

## Quick start

```bash
npm install stripe
# or: pip install stripe
```

```javascript
// server.js (Node, stripe-node)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Create a PaymentIntent for $20.00 USD
const intent = await stripe.paymentIntents.create(
  {
    amount: 2000,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { order_id: 'order_123' },
  },
  { idempotencyKey: 'order_123:create' }
);

// Return intent.client_secret to the browser; confirm with stripe.js Elements
```

## Key patterns

### PaymentIntent + Elements (recommended)
Create the PaymentIntent server-side, send `client_secret` to the browser, confirm with `stripe.confirmPayment({ elements, clientSecret, ... })`. Elements handles 3D Secure (3DS) and SCA.

### Stripe Checkout (hosted)
Create a Checkout Session and redirect: `stripe.checkout.sessions.create({ mode: 'payment', line_items: [...], success_url, cancel_url })`. Lowest integration cost.

### Subscriptions
Create a Customer, attach a PaymentMethod (or use Checkout in `mode: 'subscription'`), then `stripe.subscriptions.create({ customer, items: [{ price: 'price_xxx' }] })`. Use Stripe Billing for proration, trials, and invoices.

### Idempotency keys
Pass `{ idempotencyKey: '<unique>' }` on every state-changing call. Stripe will dedupe retries within 24 hours, preventing double charges from network retries.

### Webhooks as source of truth
Verify the signature with `stripe.webhooks.constructEvent(rawBody, sigHeader, endpointSecret)`. Handle events asynchronously and idempotently (events can be redelivered). Don't rely on the client's confirm response.

### Refunds
`stripe.refunds.create({ payment_intent: 'pi_...', amount: 500 })`. Omit `amount` for a full refund. Refunds are themselves async; listen for `charge.refunded`.

## Common pitfalls

- **Not verifying webhook signatures**: anyone can POST to your webhook URL. Use `STRIPE_WEBHOOK_SECRET` and `constructEvent` with the raw request body, not parsed JSON.
- **Using the secret key in client code**: only the publishable key (`pk_...`) belongs in the browser. `sk_...` is server-only.
- **Trusting the client confirm response**: a `paymentIntent.status === 'succeeded'` in the browser is advisory. Update your DB on the webhook event.
- **Ignoring 3DS / SCA**: amounts in EU and UK frequently require authentication. `automatic_payment_methods` and PaymentIntents handle this; legacy `charges.create` does not.
- **Missing idempotency keys**: without them, a retried POST after a network blip can charge the customer twice.
- **Storing card numbers**: never. Use Elements, Checkout, or Stripe.js `createPaymentMethod`. PCI scope is on Stripe, not you.
- **Cents vs dollars**: `amount` is in the smallest currency unit (cents for USD, yen for JPY which has no subunit). `2000` means $20.00, not $2000.

## Security considerations

- **API keys**: store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in env vars or a secret manager. Never commit. Use restricted keys for limited-scope services.
- **Webhook signatures**: always verify with the raw body. Express users: mount `express.raw({ type: 'application/json' })` on the webhook route specifically.
- **Publishable vs secret keys**: `pk_test_` / `pk_live_` are safe in the browser; `sk_test_` / `sk_live_` must never leave the server.
- **Restricted keys**: for microservices that only need to issue refunds or read charges, create a restricted key in the Stripe Dashboard with minimal scopes.
- **Live vs test mode**: use `sk_test_` for development. Never run integration tests against live keys.
- **PII in metadata**: `metadata` fields are not encrypted at rest beyond Stripe's default. Don't store SSNs, full card data, or sensitive PII there.

## Reference

- Official docs: https://docs.stripe.com
- API reference: https://docs.stripe.com/api
- Webhooks: https://docs.stripe.com/webhooks
- Testing: https://docs.stripe.com/testing
- Related: [[nextauth-authjs]], [[clerk-auth]], [[resend-email]]
