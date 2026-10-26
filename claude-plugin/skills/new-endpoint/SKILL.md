---
name: new-endpoint
description: Scaffolds an HTTP endpoint in a Shopwise Laravel service — route, FormRequest, Action, DTO, API Resource, OpenAPI entry and Pest test. Use when adding or changing a service API route.
---
# New endpoint

Layering, one file each, in this order:

1. **Contract first**: add/modify the path in `shopwise-contracts/openapi/<service>.yaml` (see `sync-contracts`).
2. **Test**: `tests/Feature/<Area>/<Verb><Noun>Test.php` — happy path, validation failure (422), auth failure (401/403), ownership (customer A cannot touch B's data).
3. **Route** in `routes/api.php`, under the `auth.jwt` middleware unless public; admin routes also `auth.jwt:admin`.
4. **FormRequest** `app/Http/Requests/<Verb><Noun>Request.php` → `rules()` plus `toData(): <Noun>Data`.
5. **DTO** `app/Data/<Noun>Data.php` — `final readonly class`, typed constructor properties, money as `Money`.
6. **Action** `app/Actions/<Verb><Noun>.php` — one public `handle()`; wraps state change + `Outbox::record(...)` in one `DB::transaction`.
7. **Controller** — invokable `app/Http/Controllers/<Verb><Noun>Controller.php`: request → `toData()` → action → Resource. No logic.
8. **Resource** `app/Http/Resources/<Noun>Resource.php` — field names exactly as in the OpenAPI schema.

Done when the new test passes, `run-checks` is green, and the `api-contract-keeper` agent reports no drift for this route.
