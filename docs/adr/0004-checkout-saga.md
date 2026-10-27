# ADR-0004: Checkout as an orchestrated saga

- Status: accepted
- Date: 2026-10-26, amended 2026-10-27 (3-D Secure, cart lock, order cancellation, commit timeout, refunds outside
  the saga)
- Amends: ADR-0001 (adds `inventory.reservation-committed`, `inventory.stock-level-changed`, `orders.order-rejected`,
  `orders.order-cancelled`, `payments.payment-requires-action` and the command topics; pricing consumes
  `checkout.completed`)

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
| 1 | Cart snapshot + lock | REST `POST /api/carts/{cartId}/snapshot` `{checkoutId}` with the caller's token | 200: lines + coupon + `version`; the cart is locked | cart 404 → checkout 404; cart 409 `cart_locked` → checkout 409; 200 with no lines or an unavailable line → checkout 422 (and unlocks); no saga |
| 2 | Pricing quote | REST `POST /api/quotes` with the caller's token | totals in minor units | unpriced line or invalid coupon → 422 (and unlocks), no saga |
| 3 | Reserve stock | command `inventory.reserve-stock` | `inventory.stock-reserved` | `inventory.reservation-failed` |
| 4 | Pay | command `payments.request-payment` | `payments.payment-succeeded` (possibly after `payments.payment-requires-action`) | `payments.payment-failed` |
| 5 | Commit stock | command `inventory.commit-reservation` | `inventory.reservation-committed` | `inventory.reservation-released` (it had expired) |
| 6 | Place order | command `orders.place-order` | `orders.order-placed` | `orders.order-rejected` |
| 7 | Close cart | REST `POST /internal/carts/{cartId}/checked-out` | 200 → `checkout.completed` | retried until it works; never compensated |

Steps 1–2 run inside the `POST /api/checkouts` request, so a bad cart or coupon is a plain 422 and the saga never
starts. Checkout creates the checkout id before step 1 so the snapshot can lock the cart for it (see "Cart lock"). The request then returns 202 and steps 3–7 run asynchronously; the storefront polls
`GET /api/checkouts/{id}`. Step 7 runs after the order exists, so it cannot fail the checkout: checkout retries it
with backoff and alerts (logs an error) after an hour.

Stock is committed (step 5) before the order is placed so that "the order exists" always means "the stock is
taken". Coupon redemption is not a step: pricing consumes `checkout.completed` and records it (see below).

### Saga states
`reserving` → `paying` (→ `awaiting_payment_action` → `paying`'s outcome) → `committing_stock` → `placing_order` →
`closing_cart` → `completed`. `awaiting_payment_action` is entered only on `payments.payment-requires-action`
(3-D Secure, see below).
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
| `payments.request-payment` | checkout → payments | `payments.payment-succeeded`, `payments.payment-failed`; interim `payments.payment-requires-action` |
| `payments.refund-payment` | checkout → payments | `payments.refunded`, `payments.payment-failed` |
| `orders.place-order` | checkout → orders | `orders.order-placed`, `orders.order-rejected` |
| `orders.cancel-order` | checkout → orders | `orders.order-cancelled` |

Saga outcome events: `checkout.completed`, `checkout.failed`. Cart publishes `cart.cart-checked-out` after step 7.

Refunds made outside the saga (Stripe dashboard or API) reach payments as `charge.refunded` and are published as
`payments.refunded` with `reason: external` (`amount` is what was refunded, possibly partial). Checkout ignores them;
notifications mails the customer.

### Idempotency
- Transport: consumers dedupe on the envelope `id` (`processed_messages`, ADR-0002).
- Business: each receiver allows **one** reservation, payment and order per `checkoutId`. A repeated command does
  not repeat the work; it re-publishes the current outcome (a new envelope id, same data). That makes it safe for
  checkout to re-send a command whenever a reply is late.
- `POST /api/checkouts` requires an `Idempotency-Key` header (the BFF sends a UUID per checkout attempt). The same
  key returns the same checkout; a cart with another checkout in progress is 409.
- Stripe calls use idempotency keys derived from the checkout: `checkout-{checkoutId}-pay` for creating the
  PaymentIntent and `checkout-{checkoutId}-refund` for the refund.
- `POST /internal/carts/{cartId}/checked-out`, `POST /internal/carts/{cartId}/unlock` and the snapshot's lock are
  idempotent per `checkoutId`.

### Timeouts and the reservation TTL
- A reservation lives **15 minutes** (inventory config). `inventory.stock-reserved` carries `expiresAt`; when it
  passes, inventory returns the stock and publishes `inventory.reservation-released` with `reason: expired`.
- Checkout re-sends a command when its reply is 30 s late, at most 3 times. After that the step has timed out.
- Payments owns the payment's deadline: it confirms the PaymentIntent synchronously with the payment method from
  the start request (`confirm: true`, no redirects) and cancels any PaymentIntent that is not final after 5 minutes
  (10 minutes once it is in `requires_action`), replying `payments.payment-failed` (`reason: timeout`). So a payment
  reply always arrives inside the 15-minute reservation. The Stripe webhook (`payment_intent.succeeded` /
  `payment_intent.payment_failed`) is also accepted; whichever arrives first decides, and the outcome is published
  once.
- While the checkout is `awaiting_payment_action`, checkout does not re-send `request-payment` every 30 s: the step's
  deadline is the event's `expiresAt` plus 1 minute. Past it, the normal re-send (30 s, 3 times) applies, then the
  step has timed out (compensation as for step 4's timeout).

### 3-D Secure
When confirming leaves the PaymentIntent in `requires_action`, payments keeps it (no cancel) and publishes
`payments.payment-requires-action` with the PaymentIntent's `clientSecret` and `expiresAt` (created + 10 minutes).
A re-sent `request-payment` re-publishes it while the action is pending.

1. Checkout moves `paying` → `awaiting_payment_action` and stores `clientSecret` and `expiresAt`.
2. `GET /api/checkouts/{id}` shows them to the checkout's customer only (`clientSecret`, `paymentActionExpiresAt`);
   admin listings never show the secret. Checkout clears both once it leaves the state.
3. The storefront, polling, sees the state and runs `stripe.handleNextAction({ clientSecret })`, then keeps polling.
4. Stripe sends `payment_intent.succeeded` or `payment_intent.payment_failed` to `/api/webhooks/stripe`; payments
   publishes `payment-succeeded`, or `payment-failed` with `authentication_required`. At `expiresAt` payments cancels
   the intent and publishes `payment-failed` with `timeout`.
5. Checkout handles the outcome exactly as in `paying` (a `payment-succeeded` or `payment-failed` is accepted in
   both states).

Without Stripe keys the fake gateway answers `pm_card_threeDSecure2Required` with `requires_action` and a fake
client secret. Other test methods: `pm_card_visa`, `pm_card_chargeDeclined`.

### Cart lock
Lines added to the cart after the snapshot would be lost when the cart closes, so the cart is locked for the
checkout:

- Step 1 (`POST /api/carts/{cartId}/snapshot` with `checkoutId`) locks the cart in the same transaction as the
  snapshot. The same `checkoutId` may take it again; another one gets 409 `cart_locked`, which `POST
  /api/checkouts` answers as 409.
- While locked, every change (items, coupon, a guest-cart merge into it) is 409 with body
  `{ message, code: "cart_locked", checkoutId }`; reads work and show `lockedByCheckoutId`. The storefront shows
  the cart read-only and links to the checkout.
- Checkout unlocks (`POST /internal/carts/{cartId}/unlock`) when it answers 422 after the snapshot and when the
  checkout fails (in the transaction that records `checkout.failed`, through the same retry as step 7).
- Step 7 (`checked-out`) closes the cart, which ends the lock.
- There is no lock TTL: a stuck checkout keeps its cart locked, and shows up in `GET /api/admin/checkouts`.

### Compensations
| Failed step | Undo | Final reason |
|---|---|---|
| 3 reserve (`reservation-failed`) | nothing | `out_of_stock` |
| 3 reserve (timeout) | `inventory.release-reservation` (a no-op if nothing was reserved) | `timeout` |
| 4 pay (`payment-failed`) | release the reservation | `payment_failed` |
| 4 pay (timeout) | `payments.refund-payment`, then release | `timeout` |
| 4 pay (`payment-failed` after `requires_action`) | release the reservation | `payment_failed` |
| 4 pay (timeout in `awaiting_payment_action`) | `payments.refund-payment` (cancels the intent), then release | `timeout` |
| 5 commit (`reservation-released`, expired) | `payments.refund-payment` | `reservation_expired` |
| 5 commit (timeout) | `payments.refund-payment` and `inventory.release-reservation` (returns committed stock too) | `timeout` |
| 6 order (`order-rejected`) | `payments.refund-payment` and `inventory.release-reservation` | `order_rejected` |
| 6 order (timeout) | `orders.cancel-order` (`reason: timeout`), `payments.refund-payment` and `inventory.release-reservation` | `timeout` |

- `payments.refund-payment` undoes whatever happened to the checkout's payment: refunds it when it succeeded
  (`payments.refunded`), cancels the PaymentIntent when it is not final yet, and re-publishes `payment-failed` when it
  already failed or never existed. Checkout treats `refunded` or `payment-failed` as "payment undone".
- `inventory.release-reservation` returns held **or committed** stock and replies `reservation-released`
  (`reason: requested`). Releasing an unknown or already released reservation re-publishes `reservation-released`
  with empty `lines`.
- `orders.cancel-order` makes sure the checkout ends with no live order. When the order was placed after all (the
  reply was late), orders sets it to `cancelled` and replies `orders.order-cancelled` with `orderId`/`number`;
  notifications mails the customer. When no order exists, orders records the cancellation, replies with
  `orderId: null`, and answers any later `place-order` for that checkout with `order-rejected` (`reason:
  cancelled`). Checkout ignores `order-placed` / `order-rejected` while the cancel is in flight and treats
  `order-cancelled` as "order undone". A cancelled order cannot be shipped.
- `payments.refund-payment` carries `customerId`, `amount` and `currency` (optional in the schema for compatibility;
  checkout always sends them). Payments refuses (logs an error, no reply) a refund whose values disagree with its
  payment.
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
- The cart is locked from the snapshot until the checkout fails or the cart closes, so no line is lost; a customer
  who wants to change the cart has to wait for the checkout to finish or fail.
- A 3-D Secure payment can hold the reservation up to 10 minutes; the 15-minute reservation still covers it.
- Step 6 timing out cancels the order rather than keeping it, so a late order never exists without its money.
