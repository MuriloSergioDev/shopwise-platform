---
name: stripe-payments
description: Stripe integration in the Shopwise payments service — PaymentIntents confirmed server-side, 3-D Secure, webhooks, refunds, the fake gateway and local webhook forwarding. Use when touching payment creation, confirmation, refunds or Stripe webhooks.
---
# Stripe payments (test mode)

ADR-0004 (checkout saga) and `shopwise-contracts/openapi/payments.yaml` are the source of truth.

- **Gateway seam**: `App\Gateways\PaymentGateway`; `StripePaymentGateway` (stripe-php) when `STRIPE_SECRET` is set,
  `FakePaymentGateway` otherwise and in tests. Only the Stripe gateway and `StripeWebhooks` import Stripe classes.
- **Pay** (command `payments.request-payment`, keyed by `checkoutId`): create **and confirm** a PaymentIntent with the
  storefront's `paymentMethodId` (`confirm: true`, no redirects), amount/currency from the checkout's quote, idempotency
  key `checkout-{checkoutId}-pay`. One payment per checkout; a repeated command re-publishes the current outcome.
  Replies: `payments.payment-succeeded`, `payments.payment-failed`, or first `payments.payment-requires-action`.
- **3-D Secure**: when the intent is `requires_action`, keep it, set the payment to `requires_action` and publish
  `payments.payment-requires-action` with `clientSecret` and `expiresAt` (created + 10 minutes). The storefront runs
  `stripe.handleNextAction`; the webhook finishes it (`authentication_required` when 3-D Secure fails).
- **Deadline**: `payments:expire-stale` (every minute) cancels intents not final after 5 minutes (10 in
  `requires_action`) and publishes `payment-failed` with `timeout`.
- **Webhook** `POST /api/webhooks/stripe` (public, no JWT): verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` on
  the raw body before anything else; dedupe on the Stripe event id. Handles `payment_intent.succeeded`,
  `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`; the outcome is published once,
  whichever of the synchronous confirm and the webhook comes first.
- **Refund** (command `payments.refund-payment`, carries `customerId`/`amount`/`currency`): full refund with
  idempotency key `checkout-{checkoutId}-refund`, or cancel a non-final intent, or re-publish the failure. Replies
  `payments.refunded` (reason from the command) or `payments.payment-failed`. A `charge.refunded` that payments did
  not request (dashboard) is published as `payments.refunded` with `reason: external`.
- **Local**: `stripe listen --forward-to localhost:8107/api/webhooks/stripe` prints the `whsec_...` for
  `STRIPE_WEBHOOK_SECRET`. Keys go in `shopwise-platform/secrets/payments.env` (gitignored → `payments-secrets`).
  Test methods: `pm_card_visa` succeeds, `pm_card_chargeDeclined` declines, `pm_card_threeDSecure2Required` needs
  3-D Secure; with the fake gateway `pm_fake_processing` never finishes (hits the deadline).
