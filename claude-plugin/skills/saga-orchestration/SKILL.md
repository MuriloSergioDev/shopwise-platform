---
name: saga-orchestration
description: How the Shopwise checkout saga is orchestrated — states, commands, replies, timeouts, cart lock and compensations (ADR-0004). Use when changing checkout, payments, inventory reservation, order placement or cart checkout flows.
---
# Checkout saga

ADR-0004 in `shopwise-platform/docs/adr/` is the source of truth; contracts live in `shopwise-contracts`
(`schemas/commands/<receiver>/`, `schemas/events/`, `openapi/checkout.yaml`). This is the working summary.

The `checkout` service owns `checkouts` (snapshot lines, quote, status, deadlines) and `checkout_steps` (a log of
every command, reply and REST call). It is the only coordinator; participants never talk to each other.

```
POST /api/checkouts: snapshot+lock cart (1) → quote (2) → 202 ─┐   (422/404/409 before this: no saga)
reserving ─stock-reserved→ paying ─payment-succeeded→ committing_stock ─reservation-committed→ placing_order
              │                │ payment-requires-action → awaiting_payment_action ─succeeded/failed→
              ▼ any failure / timeout                                         ─order-placed→ closing_cart → completed
         compensating (undo commands in flight) → failed (+ unlock cart)
```

- **Commands** are Kafka messages on topics owned by the receiver, keyed by `checkoutId`: `inventory.reserve-stock`,
  `inventory.commit-reservation`, `inventory.release-reservation`, `payments.request-payment`,
  `payments.refund-payment`, `orders.place-order`, `orders.cancel-order`. Replies are the receiver's normal events
  carrying `checkoutId` (`inventory.stock-reserved`, `payments.payment-succeeded`, `orders.order-placed`, …).
- **Transitions** live in `App\Saga\CheckoutSaga`: one method per reply, run inside a DB transaction; it checks the
  expected status (anything else is a late or duplicate reply: log it, or undo a late success), changes the row
  with an optimistic lock and records the next command through the outbox in the same transaction.
- **Idempotency**: receivers allow one reservation, payment and order per `checkoutId` and re-publish the current
  outcome on a repeated command, so checkout may re-send whenever a reply is late.
- **Timeouts**: `checkout:time-out-steps` runs every 10 s. A command is re-sent when its reply is 30 s late, at most
  3 times; then the step has timed out. In `awaiting_payment_action` the deadline is the requires-action
  `expiresAt` + 1 minute instead. Payments always replies within 5 minutes (10 with 3-D Secure); reservations
  expire after 15 minutes inside inventory.
- **3-D Secure**: `payments.payment-requires-action` carries `clientSecret`; checkout shows it on the customer's
  `GET /api/checkouts/{id}`, the storefront runs `stripe.handleNextAction`, the Stripe webhook finishes the payment.
- **Cart lock**: step 1 is `POST /api/carts/{id}/snapshot {checkoutId}`, which locks the cart; checkout unlocks it
  (`POST /internal/carts/{id}/unlock`) on a 422 after the snapshot and when the checkout fails; step 7
  (`/internal/carts/{id}/checked-out`) closes it. Edits while locked are 409 `cart_locked`.
- **Compensations** (see the ADR table): payment failed → release; pay/commit timeout → refund + release; commit
  expired → refund; order rejected → refund + release; order timeout → `orders.cancel-order` + refund + release.
  Undo commands retry (30 s × 3, then every 5 minutes); the checkout stays `compensating` until every undo is
  confirmed, then records `checkout.failed`.

Every new transition gets a test that delivers the reply twice and one that delivers it in the wrong state.
