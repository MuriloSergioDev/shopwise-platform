---
name: sync-contracts
description: Updates shopwise-contracts (OpenAPI, event schemas) and regenerates the PHP and TypeScript packages consumers use. Use after any API or event payload change, or when a consumer's types are stale.
---
# Sync contracts

1. In `shopwise-contracts`: edit `openapi/<service>.yaml` or `schemas/events/...`; run `pnpm generate` (writes `php/src/` DTOs and `ts/` types) then `pnpm check`.
2. Breaking change (removed/renamed/narrowed field, new required input)? Publish a new event version file `.v<N+1>.json` alongside the old one, or a new API path version. Old versions stay untouched until every consumer has moved.
3. Commit with `feat(contracts): ...` or `feat(contracts)!: ...`; on merge to main, release-please tags a release and CI dispatches bump PRs to consumers.
4. Locally, before the release exists: in the consumer run `composer update shopwise/contracts` (VCS `dev-main`) or `pnpm update @shopwise/contracts`.

Done when the contracts check passes and every consumer you changed compiles against the new types (`run-checks`).
