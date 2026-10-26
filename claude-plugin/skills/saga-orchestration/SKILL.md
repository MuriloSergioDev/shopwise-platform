---
name: saga-orchestration
description: How the Shopwise checkout saga is orchestrated — states, commands, replies, timeouts and compensations. Use when changing checkout, payments, inventory reservation or order placement flows.
---
# Checkout saga

The `checkout` service owns `checkout_sagas` (id, cart snapshot, quote, state, step deadline). It is the only coordinator; participants talk to it, never to each other.

```
started ─reserve-stock→ reserving ─stock-reserved→ paying ─payment-succeeded→ placing ─order-placed→ completed
                          │ reservation-failed       │ payment-failed / timeout        │ failure
                          ▼                          ▼                                 ▼
                        failed              releasing → failed            refunding → releasing → failed
```

- **Commands** travel on `<participant>.commands` topics (`inventory.commands`: `reserve-stock`, `release-reservation`; `payments.commands`: `create-payment`, `refund-payment`; `orders.commands`: `place-order`) with `saga_id` as subject. Replies are the participants' normal events carrying `saga_id`.
- Each transition is one handler: load the saga row `FOR UPDATE`, check the expected state (stale or duplicate replies are ignored), set new state + deadline, `Outbox::record` the next command — one transaction.
- **Payment** is customer-driven: on `stock-reserved` the saga sends `create-payment`; payments replies with `payments.payment-created` carrying the client secret, which the BFF polls for; the Stripe webhook later yields `payments.payment-succeeded`.
- **Timeouts**: scheduler command `checkout:expire-sagas` moves past-deadline sagas into their compensation path. Reservations also expire inside inventory (defence in depth).
- Compensations are idempotent and run in reverse order of completed steps.

Every new transition gets a test that replays the reply twice and one that delivers it in the wrong state.
