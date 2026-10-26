# Glossary (ubiquitous language)

| Term | Meaning | Owner |
|---|---|---|
| Customer | A person with an account. Guests are not customers until they register. | identity |
| Product | Sellable item shown in the catalog; has one or more Variants. | catalog |
| Variant | Concrete purchasable option of a product (size/color), identified by SKU. | catalog |
| SKU | Stock-keeping unit, unique per Variant; the join key between catalog, inventory, pricing. | catalog |
| Stock level | On-hand quantity of a SKU. | inventory |
| Reservation | Temporary hold on stock for a checkout, expires after a TTL unless committed. | inventory |
| Price | Amount in minor units (integer cents) + ISO currency for a SKU. | pricing |
| Coupon | Code that applies a Discount rule to a cart. | pricing |
| Cart | Mutable list of SKUs + quantities, owned by a guest token or customer. | cart |
| Checkout | Saga that turns a cart into an order: reserve → pay → place. | checkout |
| Payment | Stripe PaymentIntent tracked by payments; succeeds, fails or is refunded. | payments |
| Order | Immutable record of what was bought and at what price; has a fulfilment status. | orders |
| Compensation | Saga step that undoes a previous step (release reservation, refund). | checkout |
| Saga | Long-running checkout process made of local steps, each with a compensation; orchestrated by checkout (ADR-0004). | checkout |
| Saga state | Where a checkout is: reserving, paying, committing_stock, placing_order, closing_cart, completed, or compensating → failed. | checkout |
| Command | Kafka message asking one service to do something (`inventory.reserve-stock`); topic and schema owned by the receiver. | receiver |
| Reply | Event a receiver publishes as the outcome of a command, carrying the checkoutId it answers. | receiver |
| Correlation id | The `checkoutId` carried by every saga command and reply. | checkout |
| Idempotency key | Value that makes a repeated request do the work once: `Idempotency-Key` on start checkout, `checkout-{id}-pay` on Stripe calls. | every service |
| Cart snapshot | Copy of a cart's lines, coupon and version taken when a checkout starts; later cart edits do not change it. | cart |
| Checked-out cart | Cart closed by a completed checkout; the customer gets a fresh cart on next access. | cart |
| Quote | Pricing's read-only calculation of lines, discount and total for a set of SKUs and an optional coupon. | pricing |
| Redemption | Record that a customer used a coupon in a completed checkout; drives per-customer and total limits. | pricing |
| Available stock | On-hand minus reserved; what can still be reserved. | inventory |
| Reservation TTL | How long a reservation holds stock before it expires and is released (15 minutes). | inventory |
| Commit (reservation) | Turning held stock into sold stock after payment succeeds; a committed reservation no longer expires. | inventory |
| Release (reservation) | Returning held or committed stock to available, on request (compensation) or on expiry. | inventory |
| Payment method | Stripe `pm_…` id collected by the storefront and passed to start checkout. | payments |
| PaymentIntent | Stripe object for one payment attempt; payments creates and confirms one per checkout. | payments |
| Refund | Money returned for a succeeded payment, as a compensation or later. | payments |
| Order number | Human-readable order id shown to customers (`SW-000123`). | orders |
| Shipment | Carrier + tracking number recorded when an admin marks an order shipped. | orders |
| Outbox | Table in each service's DB where events are written in the same transaction as state changes, then relayed to Kafka. | every service |
| BFF | Backend-for-frontend: Nitro server inside each Nuxt app; the only public entry point. | storefront/admin |
