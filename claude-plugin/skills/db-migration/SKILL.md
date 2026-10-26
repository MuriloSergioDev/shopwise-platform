---
name: db-migration
description: Rules for writing Laravel migrations safely in Shopwise services (expand/contract, rollback, IDs, money columns). Use whenever creating or changing a migration.
---
# DB migrations

Each service owns its own Postgres database; migrations run in an init container before the HTTP pod starts, so a failing migration blocks the whole service.

- **Expand → migrate → contract** for renames and type changes: add the new column (nullable or with default), backfill in a separate migration or job, switch code, drop the old column in a later PR.
- New columns on existing tables are nullable or have a constant default.
- Every migration has a working `down()`.
- Money columns: `unsignedBigInteger('<x>_amount')` + `char('<x>_currency', 3)` (see `money-handling`).
- IDs that leave the service (events, API) are ULIDs: `$table->ulid('id')->primary()`.
- A migration merged to main is frozen; changes go in a new migration.

Done when `php artisan migrate` and `php artisan migrate:rollback --step=1` both succeed against the service's database.
