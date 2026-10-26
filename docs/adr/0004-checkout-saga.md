# ADR-0004: Checkout as an orchestrated saga

- Status: accepted
- Date: 2026-10-26
- Amends: ADR-0001 (adds `inventory.reservation-committed`, `inventory.stock-level-changed`, `orders.order-rejected`
  and the command topics; pricing consumes `checkout.completed`)

## Context
Turning a cart into an order touches four services that each own their data: inventory (stock), payments (money),
orders (the record) and cart. There is no distributed transaction. ADR-0001 rule 4 says checkout orchestrates;
this ADR fixes the steps, the messages between them, the timeouts and what gets undone when a step fails.

## Decision

### Who may check out
Only customers (a bearer token from identity). Guest carts are merged into the customer cart on login (P2), so
checkout always works on the caller's customer cart and every order has a `customerId`.

### Steps
| # | Step | How | Success | Failure |
|---|---|---|---|---|
| 1 | Cart snapshot | REST `GET /api/carts/{cartId}/snapshot` with the caller's token | lines + coupon + `version` | 404/422 → `POST /api/checkouts` answers 422, no saga |
| 2 | Pricing quote | REST `POST /api/quotes` with the caller's token | totals in minor units | unpriced line or invalid coupon → 422, no saga |
| 3 | Reserve stock | command `inventory.reserve-stock` | `inventory.stock-reserved` | `inventory.reservation-failed` |
| 4 | Pay | command `payments.request-payment` | `payments.payment-succeeded` | `payments.payment-failed` |
| 5 | Commit stock | command `inventory.commit-reservation` | `inventory.reservation-committed` | `inventory.reservation-released` (it had expired) |
| 6 | Place order | command `orders.place-order` | `orders.order-placed` | `orders.order-rejected` |
| 7 | Close cart | REST `POST /internal/carts/{cartId}/checked-out` | 200 → `checkout.completed` | retried until it works; never compensated |

Steps 1–2 run inside the `POST /api/checkouts` request, so a bad cart or coupon is a plain 422 and the saga never
starts. The request then returns 202 and steps 3–7 run asynchronously; the storefront polls
`GET /api/checkouts/{id}`. Step 7 runs after the order exists, so it cannot fail the checkout: checkout retries it
with backoff and alerts (logs an error) after an hour.

Stock is committed (step 5) before the order is placed so that "the order exists" always means "the stock is
taken". Coupon redemption is not a step: pricing consumes `checkout.completed` and records it (see below).

### Saga states
`reserving` → `paying` → `committing_stock` → `placing_order` → `closing_cart` → `completed`.
Any failure moves to `compensating` (undo commands in flight) and then `failed` with a `failureReason`:
`out_of_stock`, `payment_failed`, `reservation_expired`, `order_rejected` or `timeout`.
The state row is updated in the same transaction as the outbox rows for the next command, so a crash never loses or
duplicates a step.

### Commands and replies
- A command is a Kafka message in the ADR-0002 envelope, sent by checkout through its outbox. Its type and topic
  belong to the **receiver** (`inventory.reserve-stock`), and its schema lives in
  `shopwise-contracts/schemas/commands/<receiver>/`. Replies are ordinary events of the receiver; other services may
  consume them too (notifications consumes `payments.refunded`, `orders.order-placed`).
- Every command and every reply carries `checkoutId`, the saga's correlation id. Commands are keyed by `checkoutId`;
  replies use their own aggregate as key (reservation events use `checkoutId`, since a reservation belongs to one
  checkout).
- Command topics are declared in the receiver's chart values (the receiver owns the topic and its schema), unlike
  event topics, which the producer declares.

| Command (topic) | Sender → receiver | Replies |
|---|---|---|
| `inventory.reserve-stock` | checkout → inventory | `inventory.stock-reserved`, `inventory.reservation-failed` |
| `inventory.commit-reservation` | checkout → inventory | `inventory.reservation-committed`, `inventory.reservation-released` |
| `inventory.release-reservation` | checkout → inventory | `inventory.reservation-released` |
| `payments.request-payment` | checkout → payments | `payments.payment-succeeded`, `payments.payment-failed` |
| `payments.refund-payment` | checkout → payments | `payments.refunded`, `payments.payment-failed` |
| `orders.place-order` | checkout → orders | `orders.order-placed`, `orders.order-rejected` |

Saga outcome events: `checkout.completed`, `checkout.failed`. Cart publishes `cart.cart-checked-out` after step 7.

### Idempotency
- Transport: consumers dedupe on the envelope `id` (`processed_messages`, ADR-0002).
- Business: each receiver allows **one** reservation, payment and order per `checkoutId`. A repeated command does
  not repeat the work; it re-publishes the current outcome (a new envelope id, same data). That makes it safe for
  checkout to re-send a command whenever a reply is late.
- `POST /api/checkouts` requires an `Idempotency-Key` header (the BFF sends a UUID per checkout attempt). The same
  key returns the same checkout; a cart with another checkout in progress is 409.
- Stripe calls use idempotency keys derived from the checkout: `checkout-{checkoutId}-pay` for creating the
  PaymentIntent and `checkout-{checkoutId}-refund` for the refund.
- `POST /internal/carts/{cartId}/checked-out` is idempotent per `checkoutId`.

### Timeouts and the reservation TTL
- A reservation lives **15 minutes** (inventory config). `inventory.stock-reserved` carries `expiresAt`; when it
  passes, inventory returns the stock and publishes `inventory.reservation-released` with `reason: expired`.
- Checkout re-sends a command when its reply is 30 s late, at most 3 times. After that the step has timed out.
- Payments owns the payment's deadline: it confirms the PaymentIntent synchronously with the payment method from
  the start request (`confirm: true`, no redirects) and cancels any PaymentIntent that is not final after 5 minutes,
  replying `payments.payment-failed` (`reason: timeout`). So a payment reply always arrives well inside the 15-minute
  reservation. The Stripe webhook (`payment_intent.succeeded` / `payment_intent.payment_failed`) is also accepted;
  whichever arrives first decides, and the outcome is published once.
- 3-D Secure (`requires_action`) is out of scope: payments cancels the intent and replies `payment-failed` with
  `reason: authentication_required`. Test with `pm_card_visa` / `pm_card_chargeDeclined`.

### Compensations
| Failed step | Undo | Final reason |
|---|---|---|
| 3 reserve (`reservation-failed`) | nothing | `out_of_stock` |
| 3 reserve (timeout) | `inventory.release-reservation` (a no-op if nothing was reserved) | `timeout` |
| 4 pay (`payment-failed`) | release the reservation | `payment_failed` |
| 4 pay (timeout) | `payments.refund-payment`, then release | `timeout` |
| 5 commit (`reservation-released`, expired) | `payments.refund-payment` | `reservation_expired` |
| 6 order (`order-rejected` or timeout) | `payments.refund-payment` and `inventory.release-reservation` | `order_rejected` / `timeout` |

- `payments.refund-payment` undoes whatever happened to the checkout's payment: refunds it when it succeeded
  (`payments.refunded`), cancels the PaymentIntent when it is not final yet, and re-publishes `payment-failed` when it
  already failed or never existed. Checkout treats `refunded` or `payment-failed` as "payment undone".
- `inventory.release-reservation` returns held **or committed** stock and replies `reservation-released`
  (`reason: requested`). Releasing an unknown or already released reservation re-publishes `reservation-released`
  with empty `lines`.
- Compensation commands are retried like any other (30 s, 3 times), then every 5 minutes until replied; a checkout
  stays `compensating` until every undo is confirmed, then publishes `checkout.failed`.

### Coupons
The quote in step 2 is taken with the caller's token, so pricing can reject a coupon the customer already used
(`already_redeemed`) or that ran out (`exhausted`). Pricing records the redemption when it consumes
`checkout.completed`. Two concurrent checkouts can both pass the quote; the limit can be exceeded by that race, which
we accept.

### Internal endpoints
Step 7 runs without the customer's token. Service-to-service routes live under `/internal/`, are reachable only
inside the cluster (the BFFs never proxy them and no ingress routes them) and take no JWT. Service tokens are a
later decision.

## Consequences
- Seven steps, five command topics and their replies are more machinery than a single "place order" call, but every
  failure has a defined undo and every message can be redelivered safely.
- A customer sees the outcome a few seconds late (polling). The money can be taken and then refunded when the order
  step fails; the customer gets a refund mail through `payments.refunded`.
- Lines added to the cart after the snapshot are lost when the cart is closed; the storefront blocks cart edits
  while a checkout is in progress.
