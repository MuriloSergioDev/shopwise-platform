---
name: stripe-payments
description: Stripe integration in the Shopwise payments service — PaymentIntents, Payment Element, webhooks, refunds, test mode and local webhook forwarding. Use when touching payment creation, confirmation, refunds or Stripe webhooks.
---
# Stripe payments (test mode)

- **Gateway seam**: `App\Payments\PaymentGateway` interface; `StripeGateway` (stripe-php) at runtime, `FakePaymentGateway` in tests. Only `StripeGateway` imports Stripe classes.
- **Create** (command `create-payment`): PaymentIntent with amount/currency from the saga's quote, `metadata.saga_id`, and **idempotency key** `pi-<saga_id>`. Store `payments(id, saga_id, stripe_intent_id, status, amount, currency)`; record `payments.payment-created` with the client secret. The browser confirms through the Payment Element, so card data never reaches Shopwise.
- **Webhooks** `POST /stripe/webhook` (public route, no JWT): verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` before anything else; dedupe on Stripe `event.id` via `processed_messages`; handle `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` → update the row + `Outbox::record('payments.payment-…')`.
- **Refund** (command `refund-payment`): `refunds->create` with idempotency key `re-<saga_id>`.
- **Local**: `stripe listen --forward-to localhost:8107/stripe/webhook` prints the `whsec_...` value for `STRIPE_WEBHOOK_SECRET`. Keys live in the `payments-secrets` Kubernetes Secret, outside git. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` declines.
