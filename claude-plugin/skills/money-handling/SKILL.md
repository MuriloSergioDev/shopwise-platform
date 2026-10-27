---
name: money-handling
description: How Shopwise represents and computes money — integer minor units, brick/money, half-up rounding, USD. Use when touching prices, totals, discounts, payments or any amount field.
---
# Money

- Storage and transport: integer **minor units** + ISO 4217 currency (`{ "amount": 1999, "currency": "USD" }`) — in DB
  columns, events and APIs alike.
- PHP: `Brick\Money\Money`. Build with `Money::ofMinor($amount, $currency)`; persist with `getMinorAmount()->toInt()`.
  Eloquent: the kit's `MoneyCast` (`'price' => MoneyCast::class.':price'` reads `price_amount` + `price_currency`).
- Arithmetic stays inside `Money`. Percentage coupons round **half-up** to the cent, as pricing does:
  `$subtotal->multipliedBy($percent)->dividedBy(100, RoundingMode::HalfUp)`; a discount never exceeds the subtotal.
  Splitting an amount across lines uses `allocate()` so no cent is lost.
- Mixing currencies throws — correct behaviour; the store sells in one currency, **USD** (pricing only accepts USD).
- Display formatting happens only in the Nuxt apps (`Intl.NumberFormat`).
- Prices always come from the server: checkout totals come from a pricing quote fetched by the checkout service,
  whatever the client sends; payments charges and refunds exactly that total.
