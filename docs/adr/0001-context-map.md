# ADR-0001: Service boundaries and context map

- Status: accepted
- Date: 2026-10-26
- Amended by: ADR-0004 (checkout saga topics)

## Context
Shopwise is a learning project for microservices. We split the backend by bounded context, one Laravel
service and one database per context, communicating mainly through Kafka events.

## Decision
| Service | Owns | Publishes | Consumes |
|---|---|---|---|
| identity | customers, credentials, roles, JWT signing keys | `identity.customer-registered.v1` | – |
| catalog | products, variants, categories, media, search index | `catalog.product-published.v1`, `catalog.variant-changed.v1` | – |
| inventory | stock levels, reservations | `inventory.stock-reserved.v1`, `inventory.reservation-failed.v1`, `inventory.reservation-committed.v1`, `inventory.reservation-released.v1`, `inventory.stock-level-changed.v1` | `catalog.variant-changed.v1`, checkout commands |
| pricing | prices, coupons, coupon redemptions | `pricing.price-changed.v1` | `catalog.product-published.v1`, `catalog.variant-changed.v1`, `checkout.completed.v1` |
| cart | carts | `cart.cart-checked-out.v1` | `catalog.*`, `pricing.price-changed.v1` |
| checkout | checkout sagas | commands to inventory/payments/orders, `checkout.completed.v1`, `checkout.failed.v1` | replies from inventory/payments/orders |
| payments | payment intents, refunds | `payments.payment-succeeded.v1`, `payments.payment-failed.v1`, `payments.refunded.v1` | checkout commands, Stripe webhooks |
| orders | orders, fulfilment | `orders.order-placed.v1`, `orders.order-rejected.v1`, `orders.order-shipped.v1` | checkout commands |
| notifications | mail log | – | `identity.*`, `orders.*`, `payments.refunded.v1` |

Rules:
1. A service never reads another service's database. Data it needs is copied from events (local read models) or fetched over REST when freshness matters (checkout → pricing quote, checkout → cart snapshot).
2. Events are published only via the transactional outbox and consumed idempotently.
3. Topic name = event type without version suffix (`orders.order-placed`); the version lives in the schema.
4. Checkout is an **orchestrated saga**; other services never call each other to coordinate a checkout.
5. Only the BFFs (Nuxt Nitro) are reachable from browsers. Services authenticate requests with JWTs from identity (JWKS).

## Consequences
More moving parts and eventual consistency between read models; in exchange each service is independently
testable and the saga/outbox/idempotency patterns are explicit — which is the point of the project.
