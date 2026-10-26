---
name: inventory-reservation
description: Stock reservation rules in the Shopwise inventory service — reserve, commit, release, expiry and concurrency. Use when changing stock, reservations, or how checkout holds items.
---
# Inventory reservations

- `stock_levels(sku, on_hand, reserved)`; available = `on_hand - reserved`. `reservations(id, saga_id unique, status, expires_at)` + `reservation_lines(sku, qty)`.
- **Reserve** (command `reserve-stock`): one transaction — `SELECT ... FOR UPDATE` the stock rows ordered by `sku` (fixed lock order prevents deadlocks), check every line, increment `reserved`, insert the reservation (`expires_at = now + 15 min`), record `inventory.stock-reserved`. If any line is short, change nothing and record `inventory.reservation-failed` with the short SKUs. All-or-nothing.
- **Commit** on `orders.order-placed`: `on_hand -= qty`, `reserved -= qty`, status `committed`.
- **Release** (command `release-reservation` or the expiry job): `reserved -= qty`, status `released`, record `inventory.reservation-released`. Releasing a non-active reservation is a no-op.
- The same `saga_id` reserved twice returns the existing reservation's outcome.
- DB check constraints hold the invariants: `reserved >= 0` and `on_hand >= reserved`.
