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
| Outbox | Table in each service's DB where events are written in the same transaction as state changes, then relayed to Kafka. | every service |
| BFF | Backend-for-frontend: Nitro server inside each Nuxt app; the only public entry point. | storefront/admin |
